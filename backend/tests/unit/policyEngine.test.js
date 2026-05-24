import { describe, it, expect } from 'vitest';
import { evaluateCommand } from '../../src/policy/policyEngine.js';
import { RISK_LEVELS } from '../../src/schemas/llmResponse.schema.js';

describe('Policy Engine', () => {
  it('allows Get-ChildItem as SAFE_READ', () => {
    const result = evaluateCommand('Get-ChildItem');
    expect(result.allowed).toBe(true);
    expect(result.riskLevel).toBe(RISK_LEVELS.SAFE_READ);
    expect(result.needsConfirmation).toBe(false);
  });

  it('allows New-Item as MUTATING with confirmation required', () => {
    const result = evaluateCommand('New-Item -ItemType File -Path test.txt');
    expect(result.allowed).toBe(true);
    expect(result.riskLevel).toBe(RISK_LEVELS.MUTATING);
    expect(result.needsConfirmation).toBe(true);
  });

  it('blocks Remove-Item -Recurse', () => {
    const result = evaluateCommand('Remove-Item -Recurse -Path temp');
    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(RISK_LEVELS.BLOCKED);
  });

  it('blocks command chaining with semicolon', () => {
    const result = evaluateCommand('Get-ChildItem; Remove-Item test');
    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(RISK_LEVELS.BLOCKED);
  });

  it('blocks command chaining with pipe and OR', () => {
    const result = evaluateCommand('Get-ChildItem || Remove-Item test');
    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(RISK_LEVELS.BLOCKED);
  });

  it('blocks encoded command pattern', () => {
    const result = evaluateCommand('powershell -EncodedCommand xyz');
    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(RISK_LEVELS.BLOCKED);
  });

  it('blocks operations on C:\\Windows path', () => {
    const result = evaluateCommand('Get-ChildItem C:\\Windows');
    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(RISK_LEVELS.BLOCKED);
  });

  it('blocks unknown commands not in allowlist', () => {
    const result = evaluateCommand('Format-Disk');
    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(RISK_LEVELS.BLOCKED);
  });

  it('rejects empty command', () => {
    const result = evaluateCommand('');
    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe(RISK_LEVELS.BLOCKED);
  });
});
