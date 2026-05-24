const { exec, spawn } = require('child_process');

function executePowerShell(command) {
  return new Promise((resolve) => {
    const escaped = command.replace(/"/g, '\\"');
    const full = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${escaped}"`;

    exec(full, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        exitCode: error && typeof error.code === 'number' ? error.code : 0,
        stdout: stdout || '',
        stderr: stderr || (error ? error.message : ''),
      });
    });
  });
}

function executePowerShellStream(command, handlers = {}) {
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command];
  const child = spawn('powershell', args, {
    windowsHide: true,
  });

  const timeoutMs = 120000;
  const startedAt = Date.now();
  let settled = false;
  let stdout = '';
  let stderr = '';
  let forcedKill = false;

  const timeout = setTimeout(() => {
    forcedKill = true;
    child.kill();
  }, timeoutMs);

  const resultPromise = new Promise((resolve) => {
    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (typeof handlers.onStdout === 'function') {
        handlers.onStdout(text);
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (typeof handlers.onStderr === 'function') {
        handlers.onStderr(text);
      }
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: false,
        exitCode: 1,
        stdout,
        stderr: stderr || String(error.message || error),
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);

      const exitCode = typeof code === 'number' ? code : forcedKill ? 124 : 1;
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout,
        stderr: forcedKill ? `${stderr}\nExecution timed out` : stderr,
        durationMs: Date.now() - startedAt,
      });
    });
  });

  return {
    resultPromise,
    cancel: () => {
      if (!settled) {
        forcedKill = true;
        child.kill();
      }
    },
  };
}

module.exports = {
  executePowerShell,
  executePowerShellStream,
};
