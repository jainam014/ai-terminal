const { OpenAIProvider } = require('./openai.provider');
const { AnthropicProvider } = require('./anthropic.provider');
const { OllamaProvider } = require('./ollama.provider');

function getProvider(config = {}) {
  const providerType = String(config.provider || process.env.LLM_PROVIDER || 'openai').toLowerCase().trim();

  // For testing: allow mock provider
  if (providerType === 'mock') {
    return new OpenAIProvider(config);
  }

  switch (providerType) {
    case 'anthropic':
    case 'claude':
      return new AnthropicProvider(config);

    case 'ollama':
      return new OllamaProvider(config);

    case 'openrouter':
      return new OpenAIProvider({
        ...config,
        provider: 'openrouter',
        baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
        defaultHeaders: config.defaultHeaders || {
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:5000',
          'X-Title': process.env.OPENROUTER_APP_TITLE || 'AI Terminal',
        },
      });

    case 'custom':
      return new OpenAIProvider(config);

    case 'openai':
    default:
      return new OpenAIProvider(config);
  }
}

module.exports = {
  getProvider,
};
