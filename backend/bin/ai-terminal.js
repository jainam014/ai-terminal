#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { createAITerminal, RISK_LEVELS } = require('../index');

const CONFIG_DIR = path.join(os.homedir(), '.ai-terminal');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function question(prompt) {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (_error) {
    // ignore parse errors, return default
  }
  return null;
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

async function initWizard() {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║ AI Terminal — First Time Setup     ║');
  console.log('╚════════════════════════════════════╝\n');

  const choice = await question(
    'Choose your LLM provider:\n' +
    '  1. OpenAI          (GPT-4o, GPT-4o-mini, GPT-3.5...)\n' +
    '  2. Anthropic Claude (Claude 3 Haiku, Sonnet, Opus...)\n' +
    '  3. OpenRouter      (200+ models, one key)\n' +
    '  4. Ollama          (Local models, no API key needed)\n' +
    '  5. Custom         (Any OpenAI-compatible API)\n' +
    'Enter choice [1-5]: '
  );

  let config = {};

  switch (choice.trim()) {
    case '2':
      config.provider = 'anthropic';
      config.apiKey = await question('Enter your Anthropic API key (get one at https://console.anthropic.com): ');
      config.model = await question('Enter model name [claude-3-haiku-20240307]: ');
      config.model = config.model || 'claude-3-haiku-20240307';
      break;

    case '3':
      config.provider = 'openrouter';
      config.apiKey = await question('Enter your OpenRouter API key (get one at https://openrouter.ai/keys): ');
      config.model = await question('Enter model name [openai/gpt-4o-mini]: ');
      config.model = config.model || 'openai/gpt-4o-mini';
      break;

    case '4':
      config.provider = 'ollama';
      config.baseURL = await question('Enter Ollama URL [http://localhost:11434/v1]: ');
      config.baseURL = config.baseURL || 'http://localhost:11434/v1';
      config.model = await question('Enter model name [llama3]: ');
      config.model = config.model || 'llama3';
      break;

    case '5': {
      config.provider = 'custom';
      config.baseURL = await question('Enter base URL (e.g., https://api.mistral.ai/v1): ');
      config.apiKey = await question('Enter API key: ');
      config.model = await question('Enter model name: ');
      break;
    }

    case '1':
    default:
      config.provider = 'openai';
      config.apiKey = await question('Enter your OpenAI API key (get one at https://platform.openai.com/api-keys): ');
      config.model = await question('Enter model name [gpt-4o-mini]: ');
      config.model = config.model || 'gpt-4o-mini';
  }

  saveConfig(config);
  console.log(`\n✅ Configuration saved to ${CONFIG_FILE}`);
  console.log(`\nNext step: ai-terminal "your natural language command here"\n`);
}

async function runCommand(userMessage) {
  const config = loadConfig();
  if (!config) {
    console.log('❌ Not configured yet. Run: ai-terminal init\n');
    process.exit(1);
  }

  try {
    const terminal = createAITerminal(config);
    console.log(`\n📝 Message: ${userMessage}`);
    console.log(`🤖 Provider: ${config.provider} (${config.model})`);

    const proposal = await terminal.propose(userMessage);
    console.log(`\n✨ Proposal:`);
    console.log(`   Command: ${proposal.command}`);

    const riskEmoji =
      proposal.riskLevel === RISK_LEVELS.SAFE_READ
        ? '🟢'
        : proposal.riskLevel === RISK_LEVELS.MUTATING
          ? '🟡'
          : proposal.riskLevel === RISK_LEVELS.DESTRUCTIVE
            ? '🔴'
            : '⛔';

    console.log(`   Risk: ${riskEmoji} ${proposal.riskLevel}`);
    console.log(`   Confidence: ${(proposal.confidence * 100).toFixed(0)}%`);
    console.log(`   Explanation: ${proposal.explanation}`);

    if (!proposal.policy.allowed) {
      console.log(`\n❌ Execution blocked: ${proposal.policy.reasons?.join(', ')}`);
      return;
    }

    if (!proposal.needsConfirmation) {
      console.log('\n⚡ Auto-executing (SAFE_READ)...\n');
      const result = await terminal.execute(proposal.id);
      if (result.ok) {
        console.log(result.stdout);
      } else {
        console.error(`Error (exit code ${result.exitCode}):`);
        console.error(result.stderr);
      }
      return;
    }

    const rl = createReadlineInterface();
    rl.question('\nApprove execution? (y/N): ', async (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('\n⚡ Executing...\n');
        const result = await terminal.execute(proposal.id);
        if (result.ok) {
          console.log(result.stdout);
        } else {
          console.error(`Error (exit code ${result.exitCode}):`);
          console.error(result.stderr);
        }
      } else {
        console.log('\n⏭️  Execution cancelled.\n');
      }
    });
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'init') {
    await initWizard();
  } else if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
AI Terminal — Run natural language commands safely

Usage:
  ai-terminal init                          Setup API key and provider
  ai-terminal "your command here"          Run a natural language command
  ai-terminal --help                        Show this help

Examples:
  ai-terminal "list all files here"
  ai-terminal "delete the test.log file"
  ai-terminal "show current directory"

Providers:
  - OpenAI (requires API key)
  - Anthropic Claude (requires API key)
  - OpenRouter (requires API key)
  - Ollama (local, no API key needed)
  - Custom (any OpenAI-compatible API)
`);
  } else {
    await runCommand(args.join(' '));
  }
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
