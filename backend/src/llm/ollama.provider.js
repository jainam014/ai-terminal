const OpenAI = require('openai');
const { LLMProvider } = require('./provider.interface');
const { RISK_LEVELS } = require('../schemas/llmResponse.schema');

class OllamaProvider extends LLMProvider {
  constructor(config = {}) {
    super();
    const baseURL = config.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    this.provider = 'ollama';
    this.model = config.model || process.env.OLLAMA_MODEL || 'llama3';
    this.client = new OpenAI({
      apiKey: 'ollama',
      baseURL,
    });
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
    if (!this.model) {
      throw new Error('Missing Ollama model. Set OLLAMA_MODEL or pass model in config');
    }

    const prompt = `You are a Windows PowerShell command planner.
Return ONLY valid JSON with keys: intent, command, riskLevel, needsConfirmation, explanation, confidence.
Risk levels must be one of SAFE_READ, MUTATING, DESTRUCTIVE, BLOCKED.
Use concrete PowerShell commands that can run as-is in the current working directory.
Never use placeholder paths such as C:\\YourFolderPath. Prefer relative paths like . or .\\folder.
For recursive file queries, avoid permission noise by adding -ErrorAction SilentlyContinue when appropriate.
User request: ${input}`;

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

function mockTranslate(input) {
  const lower = String(input || '').toLowerCase();

  if (lower.includes('list') || lower.includes('files')) {
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

function parsePlannerJson(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    throw new Error('LLM returned empty response');
  }

  try {
    return JSON.parse(text);
  } catch (_directError) {
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) {
      return JSON.parse(fencedMatch[1].trim());
    }

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
    p.command = p.command.replace(/['\"]?C:\\YourFolderPath['\"]?/gi, '.');

    if (/\bGet-ChildItem\b/i.test(p.command) && /-Recurse/i.test(p.command) && !/-Path\s+/i.test(p.command)) {
      p.command = p.command.replace(/\bGet-ChildItem\b/i, 'Get-ChildItem -Path .');
    }

    if (/\bGet-ChildItem\b/i.test(p.command) && /-Recurse/i.test(p.command) && !/-ErrorAction\s+/i.test(p.command)) {
      p.command += ' -ErrorAction SilentlyContinue';
    }
  }

  return p;
}

module.exports = {
  OllamaProvider,
};
