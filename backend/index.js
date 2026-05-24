const { createOrchestrator } = require('./src/orchestrator/orchestrator');
const { evaluateCommand } = require('./src/policy/policyEngine');
const { RISK_LEVELS } = require('./src/schemas/llmResponse.schema');
const { LLMProvider } = require('./src/llm/provider.interface');
const { executePowerShell, executePowerShellStream } = require('./src/execution/powershellExecutor');
const { appendAudit } = require('./src/audit/auditService');

function createAITerminal(config = {}) {
  const orchestrator = createOrchestrator(config);

  return {
    async propose(message) {
      const proposal = await orchestrator.propose(message);
      await appendAudit({ type: 'proposal', proposal });
      return proposal;
    },

    async execute(proposalId) {
      const proposal = orchestrator.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      if (!proposal.policy.allowed) {
        await appendAudit({
          type: 'blocked_execution_attempt',
          proposalId,
          command: proposal.command,
          reasons: proposal.policy.reasons,
        });
        throw new Error(`Execution blocked: ${proposal.policy.reasons?.join(', ')}`);
      }

      const result = await executePowerShell(proposal.command);
      await appendAudit({
        type: 'execution',
        proposalId,
        command: proposal.command,
        result,
      });
      return result;
    },

    getProposal(id) {
      return orchestrator.getProposal(id);
    },
  };
}

module.exports = {
  createAITerminal,
  evaluateCommand,
  RISK_LEVELS,
  LLMProvider,
};
