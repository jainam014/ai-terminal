const crypto = require('crypto');
const { getProvider } = require('../llm/providerFactory');
const { validateProposalShape } = require('../schemas/llmResponse.schema');
const { evaluateCommand } = require('../policy/policyEngine');

const provider = getProvider();
const proposalStore = new Map();

async function proposeFromUserMessage(message) {
  const modelOutput = await provider.translate(message);
  const shape = validateProposalShape(modelOutput);

  if (!shape.ok) {
    throw new Error(`Invalid LLM proposal: ${shape.error}`);
  }

  const proposal = shape.value;
  const policy = evaluateCommand(proposal.command);

  const id = crypto.randomUUID();
  const finalProposal = {
    id,
    source: provider.name(),
    translationMode: typeof provider.getLastMode === 'function' ? provider.getLastMode() : 'unknown',
    userMessage: message,
    intent: proposal.intent,
    command: proposal.command,
    explanation: proposal.explanation,
    confidence: proposal.confidence,
    policy,
    riskLevel: policy.riskLevel,
    needsConfirmation: policy.needsConfirmation ?? proposal.needsConfirmation,
    createdAt: new Date().toISOString(),
  };

  proposalStore.set(id, finalProposal);
  return finalProposal;
}

function getProposal(id) {
  return proposalStore.get(id);
}

function createOrchestrator(config = {}) {
  const cfg = config.customProvider
    ? { customProvider: config.customProvider }
    : config;

  const orchProvider = config.customProvider || getProvider(cfg);
  const store = new Map();

  return {
    async propose(message) {
      const modelOutput = await orchProvider.translate(message);
      const shape = validateProposalShape(modelOutput);

      if (!shape.ok) {
        throw new Error(`Invalid LLM proposal: ${shape.error}`);
      }

      const proposal = shape.value;
      const policy = evaluateCommand(proposal.command);

      const id = crypto.randomUUID();
      const finalProposal = {
        id,
        source: orchProvider.name(),
        translationMode: typeof orchProvider.getLastMode === 'function' ? orchProvider.getLastMode() : 'unknown',
        userMessage: message,
        intent: proposal.intent,
        command: proposal.command,
        explanation: proposal.explanation,
        confidence: proposal.confidence,
        policy,
        riskLevel: policy.riskLevel,
        needsConfirmation: policy.needsConfirmation ?? proposal.needsConfirmation,
        createdAt: new Date().toISOString(),
      };

      store.set(id, finalProposal);
      return finalProposal;
    },

    getProposal(id) {
      return store.get(id);
    },
  };
}

module.exports = {
  proposeFromUserMessage,
  getProposal,
  createOrchestrator,
};
