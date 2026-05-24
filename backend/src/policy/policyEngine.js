const { RISK_LEVELS } = require('../schemas/llmResponse.schema');

const ALLOWLIST = new Set([
  'Get-ChildItem',
  'Get-Location',
  'Get-Content',
  'Select-String',
  'Get-Process',
  'Get-Service',
  'Get-Help',
  'ls',
  'pwd',
  'cat',
  'New-Item',
  'Set-Content',
  'Copy-Item',
  'Move-Item',
  'Rename-Item',
  'Remove-Item',
]);

const MUTATING = new Set(['New-Item', 'Set-Content', 'Copy-Item', 'Move-Item', 'Rename-Item', 'Remove-Item']);

const BLOCK_PATTERNS = [
  /(^|\s)Remove-Item\b(?=.*\s-Recurse\b)/i,
  /(^|\s)Format-\w+/i,
  /(^|\s)diskpart\b/i,
  /(^|\s)Stop-Process\b/i,
  /\|\||&&|;/,
  /-EncodedCommand\b/i,
  /reg\s+add\b/i,
];

const PROTECTED_PATHS = [/C:\\Windows/i, /C:\\Program Files/i, /C:\\ProgramData/i];

function getCommandHead(command) {
  return command.trim().split(/\s+/)[0];
}

function evaluateCommand(command) {
  const cmd = String(command || '').trim();
  if (!cmd) {
    return { allowed: false, riskLevel: RISK_LEVELS.BLOCKED, reasons: ['Empty command'] };
  }

  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(cmd)) {
      return { allowed: false, riskLevel: RISK_LEVELS.BLOCKED, reasons: ['Command matches blocked safety rule'] };
    }
  }

  for (const pathPattern of PROTECTED_PATHS) {
    if (pathPattern.test(cmd)) {
      return { allowed: false, riskLevel: RISK_LEVELS.BLOCKED, reasons: ['Protected system path access is blocked'] };
    }
  }

  const head = getCommandHead(cmd);
  if (!ALLOWLIST.has(head)) {
    return {
      allowed: false,
      riskLevel: RISK_LEVELS.BLOCKED,
      reasons: [`Command '${head}' is not allowed in MVP allowlist`],
    };
  }

  if (MUTATING.has(head)) {
    return {
      allowed: true,
      riskLevel: RISK_LEVELS.MUTATING,
      needsConfirmation: true,
      reasons: ['Mutating command requires user confirmation'],
    };
  }

  return {
    allowed: true,
    riskLevel: RISK_LEVELS.SAFE_READ,
    needsConfirmation: false,
    reasons: ['Safe read command'],
  };
}

module.exports = {
  evaluateCommand,
};
