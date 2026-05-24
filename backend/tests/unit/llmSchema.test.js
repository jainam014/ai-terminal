import { describe, it, expect } from 'vitest';
import { validateProposalShape, RISK_LEVELS } from '../../src/schemas/llmResponse.schema.js';

describe('LLM Response Schema Validation', () => {
  it('accepts a valid full proposal payload', () => {
    const payload = {
      intent: 'List files',
      command: 'Get-ChildItem',
      riskLevel: RISK_LEVELS.SAFE_READ,
      needsConfirmation: false,
      explanation: 'Lists files in current directory',
      confidence: 0.95,
    };

    const result = validateProposalShape(payload);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual(payload);
  });

  it('rejects payload missing command field', () => {
    const payload = {
      intent: 'List files',
      riskLevel: RISK_LEVELS.SAFE_READ,
      needsConfirmation: false,
      explanation: 'Lists files',
      confidence: 0.95,
    };

    const result = validateProposalShape(payload);
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects payload with invalid riskLevel', () => {
    const payload = {
      intent: 'List files',
      command: 'Get-ChildItem',
      riskLevel: 'INVALID_RISK',
      needsConfirmation: false,
      explanation: 'Lists files',
      confidence: 0.95,
    };

    const result = validateProposalShape(payload);
    expect(result.ok).toBe(false);
  });

  it('accepts payload with extra unknown fields', () => {
    const payload = {
      intent: 'List files',
      command: 'Get-ChildItem',
      riskLevel: RISK_LEVELS.SAFE_READ,
      needsConfirmation: false,
      explanation: 'Lists files',
      confidence: 0.95,
      extraField: 'should be stripped or ignored',
    };

    const result = validateProposalShape(payload);
    expect(result.ok).toBe(true);
  });
});
