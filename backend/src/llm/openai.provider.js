const OpenAI = require('openai');
const { LLMProvider } = require('./provider.interface');
const { RISK_LEVELS } = require('../schemas/llmResponse.schema');

class OpenAIProvider extends LLMProvider {
  constructor(configOverride = {}) {
    super();
    const config = Object.keys(configOverride).length > 0 ? configOverride : resolveLlmConfig();
    this.provider = config.provider || 'openai';
    this.model = config.model || '';
    this.client = config.apiKey
      ? new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseURL || undefined,
          defaultHeaders: config.defaultHeaders,
        })
      : null;
      this.lastMode = 'uninitialized';
      this.strictMode = String(process.env.LLM_STRICT_MODE || '').toLowerCase() === 'true';
  }

  name() {
    return this.provider;
  }

  getLastMode() {
    return this.lastMode;
  }

  async translate(input) {
    const deterministic = deterministicTranslate(input);
    if (deterministic) {
      this.lastMode = 'deterministic';
      return deterministic;
    }

    if (!this.client) {
      this.lastMode = 'mock_no_client';
      return mockTranslate(input);
    }

    if (!this.model) {
      throw new Error('Missing model configuration. Set LLM_MODEL or provider-specific model in .env');
    }

    const prompt = `You are a Windows PowerShell command planner.\nReturn ONLY valid JSON with keys: intent, command, riskLevel, needsConfirmation, explanation, confidence.\nRisk levels must be one of SAFE_READ, MUTATING, DESTRUCTIVE, BLOCKED.\nUse concrete PowerShell commands that can run as-is in the current working directory.\nNever use placeholder paths such as C:\\YourFolderPath. Prefer relative paths like . or .\\folder.\nFor recursive file queries, avoid permission noise by adding -ErrorAction SilentlyContinue when appropriate.\nUser request: ${input}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.choices[0]?.message?.content || '';
      const parsed = normalizePlannerPayload(parsePlannerJson(text));
      this.lastMode = 'llm';
      return parsed;
    } catch (error) {
      if (this.strictMode) {
        throw new Error(`LLM translation failed (${this.provider}): ${error.message}`);
      }
      this.lastMode = 'mock_fallback';
      return mockTranslate(input);
    }
  }
}

function deterministicTranslate(input) {
  const lower = String(input || '').toLowerCase();
  const fileNameMatch = lower.match(/([a-z0-9._-]+\.md)\b/i);
  const markdownFileName = fileNameMatch ? fileNameMatch[1] : 'new.md';

  if (
    lower.includes('current working directory') ||
    lower.includes('current directory') ||
    lower.includes('where am i') ||
    lower.includes('present working directory')
  ) {
    return {
      intent: 'Show current working directory',
      command: 'Get-Location',
      riskLevel: RISK_LEVELS.SAFE_READ,
      needsConfirmation: false,
      explanation: 'Shows the current directory path.',
      confidence: 0.95,
    };
  }

  if (
    (lower.includes('delete') || lower.includes('remove')) &&
    (lower.includes('.md') || lower.includes('markdown file') || lower.includes('md file'))
  ) {
    return {
      intent: `Delete markdown file ${markdownFileName}`,
      command: `Remove-Item -Path "${markdownFileName}" -Force`,
      riskLevel: RISK_LEVELS.MUTATING,
      needsConfirmation: true,
      explanation: `Deletes markdown file ${markdownFileName} in current path.`,
      confidence: 0.86,
    };
  }

  if (
    (lower.includes('create') || lower.includes('make')) &&
    (lower.includes('.md') || lower.includes('markdown file') || lower.includes('md file'))
  ) {
    return {
      intent: `Create markdown file ${markdownFileName}`,
      command: `New-Item -ItemType File -Path "${markdownFileName}" -Force`,
      riskLevel: RISK_LEVELS.MUTATING,
      needsConfirmation: true,
      explanation: `Creates or replaces markdown file ${markdownFileName} in current path.`,
      confidence: 0.86,
    };
  }

  return null;
}

function mockTranslate(input) {
  const lower = String(input || '').toLowerCase();

  const fileNameMatch = lower.match(/([a-z0-9._-]+\.md)\b/i);
  const markdownFileName = fileNameMatch ? fileNameMatch[1] : 'new.md';

  // Check for delete/remove first (more specific)
  if (
    (lower.includes('delete') || lower.includes('remove')) &&
    (lower.includes('.md') || lower.includes('markdown file') || lower.includes('md file'))
  ) {
    return {
      intent: `Delete markdown file ${markdownFileName}`,
      command: `Remove-Item -Path "${markdownFileName}" -Force`,
      riskLevel: RISK_LEVELS.MUTATING,
      needsConfirmation: true,
      explanation: `Deletes markdown file ${markdownFileName} in current path.`,
      confidence: 0.82,
    };
  }

  if (lower.includes('delete') || lower.includes('remove')) {
    return {
      intent: 'Delete items',
      command: 'Remove-Item -Recurse -Force temp',
      riskLevel: RISK_LEVELS.DESTRUCTIVE,
      needsConfirmation: true,
      explanation: 'Potentially destructive delete command.',
      confidence: 0.65,
    };
  }

  // Check for create after delete
  if (
    (lower.includes('create') || lower.includes('make')) &&
    (lower.includes('.md') || lower.includes('markdown file') || lower.includes('md file'))
  ) {
    return {
      intent: `Create markdown file ${markdownFileName}`,
      command: `New-Item -ItemType File -Path "${markdownFileName}" -Force`,
      riskLevel: RISK_LEVELS.MUTATING,
      needsConfirmation: true,
      explanation: `Creates or replaces markdown file ${markdownFileName} in current path.`,
      confidence: 0.8,
    };
  }

  if (lower.includes('create folder') || lower.includes('make folder') || lower.includes('new folder')) {
    return {
      intent: 'Create a folder',
      command: 'New-Item -ItemType Directory -Name demo-folder',
      riskLevel: RISK_LEVELS.MUTATING,
      needsConfirmation: true,
      explanation: 'Creates a new directory in current path.',
      confidence: 0.72,
    };
  }

  // Check for list last (most generic)
  if (lower.includes('list') || lower.includes('show files') || (lower.includes('files') && !lower.includes('delete') && !lower.includes('remove'))) {
    return {
      intent: 'List files in current directory',
      command: 'Get-ChildItem',
      riskLevel: RISK_LEVELS.SAFE_READ,
      needsConfirmation: false,
      explanation: 'Lists files and folders.',
      confidence: 0.78,
    };
  }

  return {
    intent: 'Show current location',
    command: 'Get-Location',
    riskLevel: RISK_LEVELS.SAFE_READ,
    needsConfirmation: false,
    explanation: 'Displays current directory path.',
    confidence: 0.61,
  };
}

module.exports = {
  OpenAIProvider,
};

function parsePlannerJson(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    throw new Error('LLM returned empty response');
  }

  try {
    return JSON.parse(text);
  } catch (_directError) {
    // Some models wrap JSON in markdown code fences.
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) {
      return JSON.parse(fencedMatch[1].trim());
    }

    // Fallback: extract first JSON object by braces.
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('Unable to parse JSON from LLM response');
  }
}

function normalizePlannerPayload(payload) {
  const p = payload && typeof payload === 'object' ? { ...payload } : {};

  if (typeof p.intent !== 'string' && p.intent != null) {
    p.intent = String(p.intent);
  }
  if (typeof p.command !== 'string' && p.command != null) {
    p.command = String(p.command);
  }
  if (typeof p.explanation !== 'string' && p.explanation != null) {
    p.explanation = String(p.explanation);
  }

  const confidence = Number(p.confidence);
  if (!Number.isFinite(confidence)) {
    p.confidence = 0.7;
  } else {
    p.confidence = Math.max(0, Math.min(1, confidence));
  }

  if (typeof p.needsConfirmation !== 'boolean') {
    p.needsConfirmation = p.riskLevel === RISK_LEVELS.MUTATING || p.riskLevel === RISK_LEVELS.DESTRUCTIVE;
  }

  if (typeof p.command === 'string') {
    // Replace common model placeholders with current-directory equivalent.
    p.command = p.command.replace(/['\"]?C:\\YourFolderPath['\"]?/gi, '.');

    // Keep large recursive scans scoped to current directory by default.
    if (/\bGet-ChildItem\b/i.test(p.command) && /-Recurse/i.test(p.command) && !/-Path\s+/i.test(p.command)) {
      p.command = p.command.replace(/\bGet-ChildItem\b/i, 'Get-ChildItem -Path .');
    }

    if (/\bGet-ChildItem\b/i.test(p.command) && /-Recurse/i.test(p.command) && !/-ErrorAction\s+/i.test(p.command)) {
      p.command += ' -ErrorAction SilentlyContinue';
    }
  }

  return p;
}

function resolveLlmConfig() {
  const selected = String(process.env.LLM_PROVIDER || '').trim().toLowerCase();
  const provider = selected || (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai');

  if (provider === 'openrouter') {
    return {
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || process.env.LLM_MODEL || '',
      baseURL: process.env.OPENROUTER_BASE_URL || process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || process.env.LLM_HTTP_REFERER || 'http://localhost:5000',
        'X-Title': process.env.OPENROUTER_APP_TITLE || process.env.LLM_APP_TITLE || 'AI Terminal POC',
      },
    };
  }

  return {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '',
    model: process.env.OPENAI_MODEL || process.env.LLM_MODEL || '',
    baseURL: process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || '',
    defaultHeaders: undefined,
  };
}
