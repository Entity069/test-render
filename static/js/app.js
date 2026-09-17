document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('commandForm');
  const commandInput = document.getElementById('commandInput');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const executeBtn = document.getElementById('executeBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.getElementById('btnText');
  const presetsList = document.getElementById('presetsList');

  // Terminal elements
  const terminalPlaceholder = document.getElementById('terminalPlaceholder');
  const terminalContent = document.getElementById('terminalContent');
  const terminalCommandDisplay = document.getElementById('terminalCommandDisplay');
  const terminalStdout = document.getElementById('terminalStdout');
  const terminalStderr = document.getElementById('terminalStderr');
  const executionBadge = document.getElementById('executionBadge');
  const durationBadge = document.getElementById('durationBadge');
  const copyOutputBtn = document.getElementById('copyOutputBtn');
  const clearTerminalBtn = document.getElementById('clearTerminalBtn');
  const toast = document.getElementById('toast');

  // Command History tracking
  const commandHistory = JSON.parse(sessionStorage.getItem('cmd_history') || '[]');
  let historyIndex = commandHistory.length;

  function saveHistory(cmd) {
    if (!cmd || (commandHistory.length > 0 && commandHistory[commandHistory.length - 1] === cmd)) {
      return;
    }
    commandHistory.push(cmd);
    if (commandHistory.length > 50) {
      commandHistory.shift();
    }
    sessionStorage.setItem('cmd_history', JSON.stringify(commandHistory));
    historyIndex = commandHistory.length;
  }

  // Keyboard navigation for command history (Up / Down arrows)
  commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      if (historyIndex > 0) {
        historyIndex--;
        commandInput.value = commandHistory[historyIndex] || '';
        e.preventDefault();
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        commandInput.value = commandHistory[historyIndex] || '';
        e.preventDefault();
      } else {
        historyIndex = commandHistory.length;
        commandInput.value = '';
        e.preventDefault();
      }
    }
  });

  // Clear input button
  clearInputBtn.addEventListener('click', () => {
    commandInput.value = '';
    commandInput.focus();
  });

  // Presets quick-runner
  presetsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    const cmd = btn.getAttribute('data-cmd');
    if (cmd) {
      commandInput.value = cmd;
      executeCommand(cmd);
    }
  });

  // Submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cmd = commandInput.value.trim();
    if (cmd) {
      executeCommand(cmd);
    }
  });

  // Execute command via JSON API
  async function executeCommand(cmd) {
    setLoading(true);
    saveHistory(cmd);

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: cmd }),
      });

      const data = await response.json();
      renderExecutionResult(data);
    } catch (error) {
      renderExecutionResult({
        command: cmd,
        stdout: '',
        stderr: 'Network or client error: ' + error.message,
        returncode: -1,
        execution_time: 0.0,
      });
    } finally {
      setLoading(false);
      commandInput.focus();
    }
  }

  function setLoading(isLoading) {
    executeBtn.disabled = isLoading;
    if (isLoading) {
      btnSpinner.style.display = 'inline-block';
      btnText.textContent = 'Running...';
    } else {
      btnSpinner.style.display = 'none';
      btnText.textContent = 'Run Command';
    }
  }

  function renderExecutionResult(result) {
    terminalPlaceholder.classList.add('hidden');
    terminalContent.classList.remove('hidden');

    terminalCommandDisplay.textContent = result.command || '';

    // Stdout
    if (result.stdout && result.stdout.trim().length > 0) {
      terminalStdout.textContent = result.stdout;
      terminalStdout.classList.remove('hidden');
    } else {
      terminalStdout.textContent = '';
      terminalStdout.classList.add('hidden');
    }

    // Stderr
    if (result.stderr && result.stderr.trim().length > 0) {
      terminalStderr.textContent = result.stderr;
      terminalStderr.classList.remove('hidden');
    } else {
      terminalStderr.textContent = '';
      terminalStderr.classList.add('hidden');
    }

    // Handle empty output notice
    let emptyNotice = terminalContent.querySelector('.empty-notice');
    if (!result.stdout && !result.stderr) {
      if (!emptyNotice) {
        emptyNotice = document.createElement('div');
        emptyNotice.className = 'terminal-output empty-notice';
        emptyNotice.textContent = '[Command completed with no output]';
        terminalContent.appendChild(emptyNotice);
      }
      emptyNotice.classList.remove('hidden');
    } else if (emptyNotice) {
      emptyNotice.classList.add('hidden');
    }

    // Status badge
    executionBadge.classList.remove('hidden', 'badge-success', 'badge-error');
    if (result.returncode === 0) {
      executionBadge.classList.add('badge-success');
      executionBadge.innerHTML = '&check; Exit 0';
    } else {
      executionBadge.classList.add('badge-error');
      executionBadge.innerHTML = `&cross; Exit ${result.returncode}`;
    }

    // Duration badge
    durationBadge.classList.remove('hidden');
    durationBadge.textContent = `${result.execution_time}s`;

    // Scroll to top of output
    const terminalBody = document.getElementById('terminalBody');
    terminalBody.scrollTop = 0;
  }

  // Clear terminal
  clearTerminalBtn.addEventListener('click', () => {
    terminalContent.classList.add('hidden');
    terminalPlaceholder.classList.remove('hidden');
    executionBadge.classList.add('hidden');
    durationBadge.classList.add('hidden');
  });

  // Copy terminal output
  copyOutputBtn.addEventListener('click', () => {
    if (terminalContent.classList.contains('hidden')) {
      showToast('Nothing to copy!');
      return;
    }

    const cmd = terminalCommandDisplay.textContent;
    const stdout = terminalStdout.classList.contains('hidden') ? '' : terminalStdout.textContent;
    const stderr = terminalStderr.classList.contains('hidden') ? '' : terminalStderr.textContent;

    let textToCopy = `$ ${cmd}\n`;
    if (stdout) textToCopy += stdout + '\n';
    if (stderr) textToCopy += `[STDERR]\n${stderr}\n`;

    navigator.clipboard.writeText(textToCopy.trim())
      .then(() => showToast('Output copied to clipboard!'))
      .catch(() => showToast('Failed to copy output'));
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }
});
