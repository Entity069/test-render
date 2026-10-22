import { spawn } from 'node:child_process';
import { constants } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const directory = path.dirname(fileURLToPath(import.meta.url));
const MAX_TIMEOUT_SECONDS = Math.floor(2 ** 31 / 1000);

function validateTimeout(timeout) {
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_SECONDS) {
    throw new Error(`COMMAND_TIMEOUT must be an integer between 1 and ${MAX_TIMEOUT_SECONDS} seconds.`);
  }
  return timeout;
}

export const COMMAND_TIMEOUT = validateTimeout(Number(process.env.COMMAND_TIMEOUT ?? 15));

function stopCommand(child) {
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.once('error', () => child.kill('SIGKILL'));
    killer.once('exit', (code) => {
      if (code !== 0) child.kill('SIGKILL');
    });
    return;
  }

  try {
    // Kill the process group so pipelines cannot keep the output pipes open.
    process.kill(-child.pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') child.kill('SIGKILL');
  }
}

export async function executeShellCommand(command, timeout = COMMAND_TIMEOUT) {
  validateTimeout(timeout);

  const result = {
    command: typeof command === 'string' ? command : '',
    stdout: '',
    stderr: '',
    returncode: -1,
    execution_time: 0,
    timed_out: false,
  };

  if (typeof command !== 'string') {
    result.stderr = 'Error: Command must be a string.';
    return result;
  }

  if (!command.trim()) {
    result.command = '';
    result.stderr = 'Error: Command cannot be empty.';
    return result;
  }

  const start = performance.now();

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, {
        shell: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (error) {
      result.stderr = `System error executing command: ${error.message}`;
      result.execution_time = Math.round(performance.now() - start) / 1000;
      resolve(result);
      return;
    }

    let executionError;
    const timer = setTimeout(() => {
      result.timed_out = true;
      stopCommand(child);
    }, timeout * 1000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { result.stdout += chunk; });
    child.stderr.on('data', (chunk) => { result.stderr += chunk; });
    child.once('error', (error) => { executionError = error; });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (executionError) {
        result.stderr += `System error executing command: ${executionError.message}`;
      } else if (!result.timed_out) {
        result.returncode = code ?? -(constants.signals[signal] ?? 1);
      }

      if (result.timed_out) {
        result.stderr = `${result.stderr}\n[Process timed out after ${timeout} seconds]`.trim();
      }

      result.execution_time = Math.round(performance.now() - start) / 1000;
      resolve(result);
    });
  });
}

export function createApp({ commandTimeout = COMMAND_TIMEOUT } = {}) {
  validateTimeout(commandTimeout);
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(directory, 'views'));
  app.use('/static', express.static(path.join(directory, 'static')));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get('/', (req, res) => {
    res.render('index', { command: '', result: null, timeout: commandTimeout });
  });

  app.post('/', async (req, res) => {
    const submitted = req.is('application/x-www-form-urlencoded') ? req.body?.command : '';
    const command = typeof submitted === 'string' ? submitted.trim() : '';
    const result = command ? await executeShellCommand(command, commandTimeout) : null;
    res.render('index', { command, result, timeout: commandTimeout });
  });

  app.post('/api/execute', async (req, res) => {
    const command = req.body?.command ?? '';
    const result = await executeShellCommand(command, commandTimeout);
    res.json(result);
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'node-command-runner' });
  });

  return app;
}

export const app = createApp();
export default app;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Command Runner listening on http://localhost:${port}`);
  });
  server.on('error', (error) => {
    console.error(`Could not start Command Runner: ${error.message}`);
    process.exitCode = 1;
  });
}
