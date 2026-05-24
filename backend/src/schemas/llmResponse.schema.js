const { z } = require('zod');

const RISK_LEVELS = {
  SAFE_READ: 'SAFE_READ',
  MUTATING: 'MUTATING',
  DESTRUCTIVE: 'DESTRUCTIVE',
  BLOCKED: 'BLOCKED',
};

const proposalSchema = z.object({
  intent: z.string().trim().min(1, 'intent must be a non-empty string'),
  command: z.string().trim().min(1, 'command must be a non-empty string'),
  riskLevel: z.enum([RISK_LEVELS.SAFE_READ, RISK_LEVELS.MUTATING, RISK_LEVELS.DESTRUCTIVE, RISK_LEVELS.BLOCKED]),
  needsConfirmation: z.boolean(),
  explanation: z.string().trim().min(1, 'explanation must be a non-empty string'),
  confidence: z.coerce.number().min(0, 'confidence must be a number from 0 to 1').max(1, 'confidence must be a number from 0 to 1').default(0.5),
});

function validateProposalShape(input) {
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues && parsed.error.issues[0];
    return { ok: false, error: issue ? issue.message : 'Invalid proposal payload' };
  }

  return {
    ok: true,
    value: parsed.data,
  };
}

module.exports = {
  RISK_LEVELS,
  proposalSchema,
  validateProposalShape,
};
