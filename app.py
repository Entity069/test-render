import os
import subprocess
import time
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Execution timeout in seconds (default: 15s to prevent hanging)
COMMAND_TIMEOUT = int(os.environ.get("COMMAND_TIMEOUT", "15"))


def execute_shell_command(command: str) -> dict:
    """Execute a shell command with a timeout and return stdout, stderr, and metadata."""
    if not command or not command.strip():
        return {
            "command": "",
            "stdout": "",
            "stderr": "Error: Command cannot be empty.",
            "returncode": -1,
            "execution_time": 0.0,
            "timed_out": False,
        }

    start_time = time.perf_counter()
    timed_out = False
    stdout = ""
    stderr = ""
    returncode = 0

    try:
        process = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=COMMAND_TIMEOUT,
        )
        stdout = process.stdout
        stderr = process.stderr
        returncode = process.returncode
    except subprocess.TimeoutExpired as e:
        timed_out = True
        returncode = -1
        stdout = e.stdout.decode() if isinstance(e.stdout, bytes) else (e.stdout or "")
        stderr = (
            (e.stderr.decode() if isinstance(e.stderr, bytes) else (e.stderr or ""))
            + f"\n[Process timed out after {COMMAND_TIMEOUT} seconds]"
        ).strip()
    except Exception as e:
        returncode = -1
        stderr = f"System error executing command: {str(e)}"

    elapsed_time = round(time.perf_counter() - start_time, 3)

    return {
        "command": command,
        "stdout": stdout,
        "stderr": stderr,
        "returncode": returncode,
        "execution_time": elapsed_time,
        "timed_out": timed_out,
    }


@app.route("/", methods=["GET", "POST"])
def index():
    result = None
    command = ""

    if request.method == "POST":
        command = request.form.get("command", "").strip()
        if command:
            result = execute_shell_command(command)

    return render_template("index.html", command=command, result=result, timeout=COMMAND_TIMEOUT)


@app.route("/api/execute", methods=["POST"])
def api_execute():
    data = request.get_json(silent=True) or {}
    command = data.get("command", "")
    if not command and "command" in request.form:
        command = request.form.get("command", "")

    result = execute_shell_command(command)
    status_code = 200 if result["returncode"] == 0 else 400
    # Return 200 for API consumers to inspect the execution payload cleanly
    return jsonify(result), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "flask-command-runner"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() in ("true", "1", "yes")
    app.run(host="0.0.0.0", port=port, debug=debug)
