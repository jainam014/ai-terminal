# ai-terminal-core

[![npm version](https://img.shields.io/npm/v/ai-terminal-core.svg)](https://www.npmjs.com/package/ai-terminal-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/ai-terminal-core.svg)](https://www.npmjs.com/package/ai-terminal-core)

Convert natural language into safe, audited PowerShell commands. Use any LLM provider — OpenAI, Claude, Ollama, OpenRouter, or bring your own.

## ✨ Features

- 🤖 **Multi-LLM Support**: OpenAI, Anthropic Claude, Ollama (local), OpenRouter, or custom providers
- 🛡️ **Safety-First**: Policy engine blocks dangerous commands before execution
- 📊 **Audit Logging**: SQLite database tracks all proposals and executions
- 🎯 **Smart Risk Assessment**: SAFE_READ, MUTATING, DESTRUCTIVE, BLOCKED risk levels
- 💻 **CLI Tool**: Interactive terminal interface with init wizard
- 📚 **Library API**: Use in your Node.js projects programmatically
- ✅ **18 Tests**: Comprehensive unit and integration tests

## 🚀 Installation

### As a CLI Tool (Global)
```bash
npm install -g ai-terminal-core
ai-terminal init              # Configure API key & provider
ai-terminal "list all files"  # Run a command
```

### As a Library
```bash
npm install ai-terminal-core
```

## 📖 Usage

### CLI Tool

**First-time setup:**
```bash
ai-terminal init
# Choose provider: OpenAI / Claude / OpenRouter / Ollama / Custom
# Enter API key (if needed)
# Config saved to ~/.ai-terminal/config.json
```

**Run commands:**
```bash
ai-terminal "list all files in current directory"
# Output: Get-ChildItem (SAFE_READ) → auto-executes

ai-terminal "delete all .log files"
# Output: Remove-Item *.log (MUTATING) → asks approval

ai-terminal "format C: drive"
# Output: BLOCKED - Command matches blocked safety rule
```

### Library API

```javascript
const { createAITerminal, RISK_LEVELS } = require('ai-terminal-core');

// Create terminal with your LLM
const terminal = createAITerminal({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
});

// Propose a command from natural language
const proposal = await terminal.propose('show me all running processes');

console.log(proposal.command);        // Get-Process
console.log(proposal.riskLevel);      // SAFE_READ
console.log(proposal.confidence);     // 0.95 (95%)
console.log(proposal.policy.allowed); // true

// Execute if safe (no confirmation needed for SAFE_READ)
if (proposal.policy.allowed && !proposal.needsConfirmation) {
  const result = await terminal.execute(proposal.id);
  console.log(result.stdout);
}

// For MUTATING commands, require user approval
if (proposal.needsConfirmation) {
  console.log('Requires approval:', proposal.explanation);
  // User approves...
  const result = await terminal.execute(proposal.id);
}
```

## 🧠 Supported LLM Providers

### Built-in Providers

#### OpenAI (GPT-4, GPT-3.5, etc.)
```javascript
createAITerminal({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4o-mini'
})
```
Get API key: https://platform.openai.com/api-keys

#### Anthropic Claude
```javascript
createAITerminal({
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-3-haiku-20240307'
})
```
Get API key: https://console.anthropic.com

#### Ollama (Local Models)
```javascript
createAITerminal({
  provider: 'ollama',
  model: 'llama3'
  // No API key needed! Runs locally at http://localhost:11434
})
```
Install Ollama: https://ollama.ai

#### OpenRouter (200+ Models)
```javascript
createAITerminal({
  provider: 'openrouter',
  apiKey: 'sk-or-...',
  model: 'openai/gpt-4o'
})
```
Get API key: https://openrouter.ai/keys

#### Custom OpenAI-Compatible API
```javascript
createAITerminal({
  provider: 'custom',
  apiKey: 'your-key',
  baseURL: 'https://api.mistral.ai/v1',
  model: 'mistral-small'
})
```
Works with: Mistral, Groq, Together, and any OpenAI-compatible API

#### Custom Provider (Advanced)
```javascript
const { LLMProvider } = require('ai-terminal-core');

class MyProvider extends LLMProvider {
  async translate(input) {
    // Call your API, return:
    // { intent, command, riskLevel, needsConfirmation, explanation, confidence }
  }
  
  name() {
    return 'my-provider';
  }
}

createAITerminal({ customProvider: new MyProvider() })
```

## 🔒 Risk Levels

| Level | Behavior | Example |
|-------|----------|---------|
| **SAFE_READ** | Auto-executes, no confirmation | `Get-ChildItem`, `Get-Location` |
| **MUTATING** | Requires user approval | `New-Item`, `Remove-Item`, `Set-Content` |
| **DESTRUCTIVE** | Requires approval, flagged as risky | `Remove-Item -Recurse` |
| **BLOCKED** | Never executes | Command chaining, system path access, unknown commands |

## 🛡️ Safety Features

- ✅ **Allowlist-based execution** — Only whitelisted commands run
- ✅ **Pattern blocking** — Blocks command chaining (`;`, `||`, `&&`), encoded commands
- ✅ **Path protection** — Prevents access to `C:\Windows`, `C:\Program Files`
- ✅ **LLM validation** — Rejects malformed LLM output
- ✅ **Audit trail** — All actions logged to SQLite for compliance

## 📦 Configuration

### Environment Variables (Optional)

```bash
# LLM Provider
LLM_PROVIDER=openai              # or: anthropic, ollama, openrouter, custom
LLM_API_KEY=sk-...               # API key for the provider
LLM_MODEL=gpt-4o-mini            # Model name
LLM_BASE_URL=https://...         # For custom providers
LLM_STRICT_MODE=false            # Fail on LLM errors (default: fallback to mock)

# Ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3

# OpenRouter
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o
```

### Config File (`~/.ai-terminal/config.json`)

Created automatically by `ai-terminal init`:
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4o-mini"
}
```

## 📊 Audit Logging

All proposals and executions are logged to `~/.ai-terminal/audit.db`:

```javascript
// Audit data is automatically saved when you use propose() and execute()
// View logs in SQLite:
// sqlite3 ~/.ai-terminal/audit.db
// SELECT * FROM executions;
```

## 🧪 Testing

```bash
npm test                # Run all tests (18 tests)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

## 📚 API Reference

### `createAITerminal(config)`

Returns an object with methods:

#### `propose(message: string): Promise<Proposal>`
Translates natural language to a command proposal.

**Returns:**
```typescript
{
  id: string,                    // Unique proposal ID
  source: string,                // LLM provider name
  translationMode: string,       // 'llm' | 'deterministic' | 'mock_fallback'
  userMessage: string,           // Original user input
  intent: string,                // What the user wants to do
  command: string,               // PowerShell command
  explanation: string,           // Why this command
  confidence: number,            // 0-1 confidence score
  riskLevel: string,             // SAFE_READ | MUTATING | DESTRUCTIVE | BLOCKED
  policy: {
    allowed: boolean,            // Can this execute?
    riskLevel: string,
    needsConfirmation: boolean,
    reasons: string[]
  },
  needsConfirmation: boolean,
  createdAt: string              // ISO timestamp
}
```

#### `execute(proposalId: string): Promise<ExecutionResult>`
Executes a proposal if it's allowed by policy.

**Returns:**
```typescript
{
  ok: boolean,
  exitCode: number,
  stdout: string,
  stderr: string,
  durationMs: number
}
```

#### `getProposal(id: string): Proposal | undefined`
Retrieve a proposal by ID.

### `evaluateCommand(command: string): PolicyEvaluation`
Low-level policy check without LLM.

```javascript
const { evaluateCommand } = require('ai-terminal-core');

const policy = evaluateCommand('Get-ChildItem');
// { allowed: true, riskLevel: 'SAFE_READ', needsConfirmation: false, reasons: [...] }
```

### `RISK_LEVELS`
```javascript
const { RISK_LEVELS } = require('ai-terminal-core');

console.log(RISK_LEVELS.SAFE_READ);      // 'SAFE_READ'
console.log(RISK_LEVELS.MUTATING);       // 'MUTATING'
console.log(RISK_LEVELS.DESTRUCTIVE);    // 'DESTRUCTIVE'
console.log(RISK_LEVELS.BLOCKED);        // 'BLOCKED'
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Local dev setup
- Testing requirements
- Code style guidelines
- How to add new safety rules

## 📝 License

MIT © 2026 AI Terminal Contributors

## 🔗 Links

- **GitHub**: https://github.com/jainam014/ai-terminal
- **NPM**: https://www.npmjs.com/package/ai-terminal-core
- **Issues**: https://github.com/jainam014/ai-terminal/issues

## ⚠️ Security

If you discover a security vulnerability, please email security@ai-terminal.dev instead of using the issue tracker.

## 🙋 Support

- 📖 Read the [full documentation](../README.md)
- 🐛 Report bugs on [GitHub Issues](https://github.com/jainam014/ai-terminal/issues)
- 💬 Discuss ideas on [GitHub Discussions](https://github.com/jainam014/ai-terminal/discussions)
