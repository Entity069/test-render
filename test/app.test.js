import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp, executeShellCommand } from '../app.js';

let server;
let baseURL;

before(async () => {
  server = createApp({ commandTimeout: 1 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

function postCommand(command) {
  return fetch(`${baseURL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
}

test('the console renders the Node.js template and configured timeout', async () => {
  const response = await fetch(baseURL);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Node\.js Command Runner/);
  assert.match(html, /id="commandInput"/);
  assert.match(html, /Timeout: 1s/);
  assert.doesNotMatch(html, /\{%|\{\{|<%/);
});

test('the existing stylesheet and browser script are served', async () => {
  const responses = await Promise.all([
    fetch(`${baseURL}/static/css/style.css`),
    fetch(`${baseURL}/static/js/app.js`),
  ]);
  assert.equal(responses[0].status, 200);
  assert.match(responses[0].headers.get('content-type'), /text\/css/);
  assert.match(await responses[0].text(), /\.terminal-output/);
  assert.equal(responses[1].status, 200);
  assert.match(responses[1].headers.get('content-type'), /javascript/);
  assert.match(await responses[1].text(), /\/api\/execute/);
});

test('the health endpoint identifies the Node.js service', async () => {
  const response = await fetch(`${baseURL}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'healthy',
    service: 'node-command-runner',
  });
});

test('successful commands retain the original JSON response fields', async () => {
  const command = "printf 'hello from node 🌍\\n'";
  const response = await postCommand(command);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(Object.keys(result).sort(), [
    'command', 'execution_time', 'returncode', 'stderr', 'stdout', 'timed_out',
  ]);
  assert.equal(result.command, command);
  assert.equal(result.stdout, 'hello from node 🌍\n');
  assert.equal(result.stderr, '');
  assert.equal(result.returncode, 0);
  assert.equal(result.timed_out, false);
  assert.ok(result.execution_time >= 0);
});

test('nonzero exits return HTTP 200 and preserve stdout and stderr', async () => {
  const response = await postCommand('printf output; printf error >&2; exit 7');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.returncode, 7);
  assert.equal(result.stdout, 'output');
  assert.equal(result.stderr, 'error');
  assert.equal(result.timed_out, false);
});

test('missing executables return an execution error', async () => {
  const response = await postCommand('some_non_existent_command_xyz_123');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.notEqual(result.returncode, 0);
  assert.ok(result.stderr.length > 0);
});

test('empty and invalid commands return structured errors', async () => {
  for (const command of [undefined, '', '   ', 42, [], {}]) {
    const response = await postCommand(command);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.returncode, -1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Command (cannot be empty|must be a string)/);
    assert.equal(result.timed_out, false);
  }
});

test('the API also accepts URL encoded form data', async () => {
  const response = await fetch(`${baseURL}/api/execute`, {
    method: 'POST',
    body: new URLSearchParams({ command: 'printf form-api' }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).stdout, 'form-api');
});

test('HTML form submissions render results and escape command output', async () => {
  const response = await fetch(baseURL, {
    method: 'POST',
    body: new URLSearchParams({ command: `printf '<script>alert("output")</script>'` }),
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /&lt;script&gt;alert/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /badge-success/);
});

test('commands with no output render an explicit notice in the form fallback', async () => {
  const response = await fetch(baseURL, {
    method: 'POST',
    body: new URLSearchParams({ command: 'true' }),
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /\[Command completed with no output\]/);
});

test('timeouts stop pipelines and preserve partial output', { timeout: 5000 }, async () => {
  const response = await postCommand('printf ready; printf warning >&2; sleep 10 | cat');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.returncode, -1);
  assert.equal(result.timed_out, true);
  assert.equal(result.stdout, 'ready');
  assert.match(result.stderr, /warning\n\[Process timed out after 1 seconds\]/);
  assert.ok(result.execution_time >= 1);
  assert.ok(result.execution_time < 5);
});

test('invalid timeout settings are rejected', () => {
  for (const commandTimeout of [0, -1, NaN, 1.5, Infinity, 2147484]) {
    assert.throws(() => createApp({ commandTimeout }), /COMMAND_TIMEOUT must be an integer/);
  }
});

test('process creation errors become command results', async () => {
  const result = await executeShellCommand('printf \0');
  assert.equal(result.returncode, -1);
  assert.equal(result.timed_out, false);
  assert.match(result.stderr, /System error executing command:/);
});
