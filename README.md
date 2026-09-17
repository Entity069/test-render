# Flask Command Runner Console

A modern, responsive web console built with **Flask**, **Vanilla CSS**, and **Docker Compose** that executes shell commands in an isolated container environment and streams output in real time.

---

## Features

- **Terminal-Inspired UI**: Dark mode developer aesthetic featuring Google Fonts (`Inter` & `JetBrains Mono`), glassmorphic panels, and execution badges.
- **Real-Time Execution & Fallback**:
  - Asynchronous AJAX execution with JSON API (`/api/execute`) for seamless interaction without page reloads.
  - Progressive enhancement: standard HTML POST form fallback works even if JavaScript is disabled.
- **Terminal Capabilities**:
  - Command history navigation with <kbd>&uarr;</kbd> and <kbd>&darr;</kbd> arrow keys.
  - Quick-preset command pills (`uname -a`, `python3 --version`, `ls -la`, `df -h`, `cat /etc/os-release`, `whoami & id`).
  - One-click copy output to clipboard with toast notification.
  - Color-coded exit codes (Exit 0 vs. Exit non-zero).
  - Distinct stderr and stdout output panels.
- **Safeguards & Containerization**:
  - Configurable execution timeout (`COMMAND_TIMEOUT`, default: 15 seconds) to prevent hanging processes.
  - Non-root unprivileged container user (`appuser`).
  - Resource limits (`cpus: 1.0`, `memory: 512M`) via Docker Compose.
  - Docker health check on `/health`.

---

## Quickstart with Docker Compose (Recommended)

### 1. Build and Start the Container

```bash
docker compose up --build -d
```

### 2. Access the Web Console

Open your browser and visit:
```
http://localhost:5000
```

### 3. Check Container Status and Logs

```bash
docker compose ps
docker compose logs -f
```

### 4. Stop the Container

```bash
docker compose down
```

---

## Quickstart Locally (Without Docker)

### 1. Set Up Virtual Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Run the Development Server

```bash
python3 app.py
```

Access the application at `http://localhost:5000`.

---

## API Reference

### 1. `POST /api/execute`
Execute a shell command asynchronously and receive structured JSON output.

- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "command": "uname -a"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "command": "uname -a",
    "stdout": "Linux 6.8.0 ... x86_64 GNU/Linux\n",
    "stderr": "",
    "returncode": 0,
    "execution_time": 0.012,
    "timed_out": false
  }
  ```

### 2. `GET /health`
Container health check endpoint.
- **Response**: `{"service": "flask-command-runner", "status": "healthy"}`

---

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Listening HTTP port | `5000` |
| `COMMAND_TIMEOUT` | Max execution duration in seconds before terminating a command | `15` |
| `FLASK_DEBUG` | Enable Flask debug mode (`true` or `false`) | `false` |

---

## Security Considerations

> [!WARNING]
> Executing commands submitted over the web inherently grants shell execution within the host or container environment.
> - **Container Isolation**: When running via Docker, commands are isolated from your host filesystem and run under an unprivileged user (`appuser`).
> - **Do not expose to public networks**: Do not expose port 5000 to the public internet without an authentication layer (e.g. reverse proxy with Basic Auth, OAuth, or VPN).
