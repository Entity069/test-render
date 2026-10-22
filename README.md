# Node.js Command Runner Console

A web console built with Node.js, Express, EJS, and vanilla JavaScript for running shell commands locally or inside Docker. It displays stdout, stderr, exit codes, and execution time after each command finishes.

## Run locally

Requires Node.js 22 or newer and npm.

```bash
npm ci
npm start
```

Open <http://localhost:5000>. Use `npm run dev` to restart the server automatically when its JavaScript files change.

## Run with Docker Compose

```bash
docker compose up --build -d
```

Open <http://localhost:5000>. The container runs Node.js 24 as the unprivileged `node` user, with a health check and Compose limits of one CPU and 512 MB of memory.

```bash
docker compose logs -f
docker compose down
```

## Console features

- Execute commands through the JSON API without reloading the page.
- Submit the HTML form with JavaScript disabled.
- Navigate command history using the up and down arrow keys.
- Run presets, including `node --version`, `uname -a`, and `ls -la`.
- Copy output, clear the terminal, and view separate stdout and stderr panels.
- Stop commands after the configured timeout, keeping output produced before termination.

Commands run independently in the server's working directory. Changes such as `cd` and shell variables do not persist between requests. Output is returned when execution finishes; it is not streamed.

## API

### `POST /api/execute`

Accepts JSON or URL encoded form data with a `command` string:

```bash
curl http://localhost:5000/api/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"node --version"}'
```

The response keeps the original API's fields:

```json
{
  "command": "printf hello",
  "stdout": "hello",
  "stderr": "",
  "returncode": 0,
  "execution_time": 0.012,
  "timed_out": false
}
```

Command results always return HTTP 200, including command failures and timeouts. Inspect `returncode`, `stderr`, and `timed_out` to determine the outcome. Empty or invalid command values return `returncode: -1`; malformed JSON returns HTTP 400.

### `GET /health`

```json
{"status":"healthy","service":"node-command-runner"}
```

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | HTTP port, from 1 to 65535 | `5000` |
| `COMMAND_TIMEOUT` | Maximum command duration in whole seconds, from 1 to 2147483 | `15` |
| `NODE_ENV` | Set to `production` for production Express behavior and template caching | Set by Docker |

For example:

```bash
PORT=3000 COMMAND_TIMEOUT=30 npm start
```

## Tests

```bash
npm test
```

Uses Node.js's built-in test runner. The tests start the application on an available local port and exercise the HTTP routes and command execution.

## Access

This application intentionally executes submitted shell commands and has no authentication. Run it on a trusted network. Local execution uses your account's permissions; Docker execution uses the container's `node` account. Add authentication through a reverse proxy or VPN before making the console reachable by other users.
