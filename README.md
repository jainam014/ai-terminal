# AI Terminal 🤖

Convert natural language into safe PowerShell commands using AI. Type what you want to do, get the exact command to review, approve, and execute — all with full audit logging.

> **Status:** Production-ready | **Windows:** 10+ | **Node.js:** 18+

---

## How It Works

```
You: "list files in downloads"
     ↓
[LLM Translation]  → Intent & proposed command
     ↓
[Policy Engine]    → Risk assessment & safety validation
     ↓
[Approval Gate]    → You review & approve (or reject)
     ↓
[Executor]         → Command runs in PowerShell
     ↓
[Audit Log]        → Full history stored locally
```

---

## Install & Run

### Option 1: Desktop App (Recommended for Everyone)

1. **Download** the latest `AI-Terminal-Setup.exe` from [Releases](https://github.com/youruser/ai-terminal/releases)
2. **Run installer** — standard Windows wizard
3. **First launch** — enter your OpenRouter or OpenAI API key
4. **Done** — start typing natural language commands

No command line, no Node.js, no setup needed.

### Option 2: CLI (For Developers)

```powershell
# Clone the repo
git clone https://github.com/youruser/ai-terminal
cd ai-terminal/backend

# Copy example env and add your API key
copy .env.example .env
# Edit .env: set OPENROUTER_API_KEY or OPENAI_API_KEY

# Install and run
npm install
npm start

# In a new terminal, use the CLI:
npm run ai -- "list all files in the current directory"
npm run ai -- "create a new markdown file called notes.md"
npm run ai -- "show me the contents of README"
```

### Option 3: Web UI (For Developers)

```powershell
# In one terminal (backend):
cd ai-terminal/backend
npm install
npm start

# In another terminal (frontend):
cd ai-terminal/frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Policy Rules

Commands are classified by risk level. **Safe reads execute immediately. Mutating/destructive commands require approval.**

| Risk Level | Examples | Approval Required |
|-----------|----------|-------------------|
| **SAFE_READ** | `Get-ChildItem`, `Get-Content`, `Get-Location`, `Get-Process` | ❌ No |
| **MUTATING** | `New-Item`, `Set-Content`, `Copy-Item`, `Remove-Item` (simple) | ✅ Yes |
| **DESTRUCTIVE** | `Remove-Item -Recurse`, `Format-*`, `Stop-Process` | 🚫 Blocked |
| **BLOCKED** | `-EncodedCommand`, `reg add`, `diskpart`, `C:\Windows` paths | 🚫 Blocked |

---

## CLI Examples

```powershell
# List files
npm run ai -- "show me all files"

# Create file
npm run ai -- "create a new file called notes.md"

# Show file content
npm run ai -- "read the README file"

# Find text
npm run ai -- "search for 'error' in log files"

# Get current directory
npm run ai -- "where am i right now"

# Create folder
npm run ai -- "make a folder called my-project"

# Copy files
npm run ai -- "copy all text files to a backup folder"

# Safe system info
npm run ai -- "show me running processes"

# ❌ These will be BLOCKED:
npm run ai -- "delete everything recursively"
npm run ai -- "format the C drive"
npm run ai -- "delete windows folder"
```

---

## Architecture

```
ai-terminal/
├── backend/                          # Node.js + Express
│   ├── src/
│   │   ├── llm/                      # LLM provider (OpenRouter, OpenAI)
│   │   │   ├── provider.interface.js # Plugin interface
│   │   │   ├── openai.provider.js    # OpenAI-compatible SDK
│   │   │   └── providerFactory.js    # Provider selection
│   │   ├── orchestrator/             # Command flow coordinator
│   │   ├── policy/                   # Safety engine
│   │   │   └── policyEngine.js       # Allowlist/blocklist/risk classifier
│   │   ├── execution/                # PowerShell runner
│   │   │   └── powershellExecutor.js # Spawn & stream output
│   │   ├── audit/                    # Logging
│   │   │   └── auditService.js       # SQLite audit trail
│   │   └── schemas/                  # Data validation
│   │       └── llmResponse.schema.js # Zod schema for LLM JSON
│   ├── cli/
│   │   └── ai.js                     # CLI entry point
│   ├── storage/
│   │   ├── schema.sql                # DB schema
│   │   └── audit.db                  # SQLite audit database
│   ├── server.js                     # Express API server
│   └── package.json
│
├── frontend/                         # React + Vite
│   ├── src/
│   │   └── main.jsx                  # React root
│   ├── App.jsx                       # Main UI component
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── desktop/                          # Electron app
│   ├── main.js                       # Electron main process
│   ├── preload.js                    # IPC bridge
│   ├── firstRun.html                 # API key setup wizard
│   └── firstRun.js
│
├── assets/
│   └── icon.ico                      # App icon
│
└── docs/
    └── IMPLEMENTATION_BLUEPRINT.md    # Full technical spec
```

**Key modules:**
- **LLM Provider**: Pluggable interface. Supports OpenRouter + OpenAI. Deterministic fallback for common prompts.
- **Policy Engine**: Allowlist-based (only safe commands pass). Blocks patterns: `Remove-Item -Recurse`, `Stop-Process`, encoded commands, system paths.
- **Execution**: Spawns PowerShell, captures stdout/stderr, enforces 2-minute timeout.
- **Audit**: SQLite logs every proposal, approval, and execution.

---

## Configuration

### Environment Variables (`.env`)

```bash
PORT=5000

# Provider selection
LLM_PROVIDER=openrouter        # or: openai

# OpenRouter (recommended, free tier available)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# OpenAI (optional)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-mini
```

**First-time setup:**
1. Go to [openrouter.ai](https://openrouter.ai) or [openai.com](https://platform.openai.com)
2. Create an API key
3. Add to `.env` (never commit this!)
4. Run the app

---

## Testing

```bash
cd backend

# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

Tests cover:
- Policy engine (allowlist/blocklist rules)
- LLM schema validation
- `/propose` API endpoint
- PowerShell execution safety

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- How to fork and create PRs
- Local dev setup
- Code style & commit conventions
- How to add new policy rules

**Ideas for contributions:**
- More deterministic patterns (reduce LLM calls)
- Additional safety rules
- UI improvements
- Better error messages
- Performance optimizations
- macOS/Linux support (PowerShell Core)

---

## Security & Privacy

✅ **What stays local:**
- Your commands are executed on your machine
- API key is stored locally only
- Audit log is stored in SQLite on your machine
- Nothing is sent to our servers

✅ **What's safe:**
- All LLM output is validated against a schema
- Commands are checked against policy rules before execution
- User must approve every mutating command
- System directories and dangerous patterns are blocked

⚠️ **Important:**
- Keep your API key private (use `.env`, never commit)
- Review each command before approving
- This tool has the same permissions as your user account

---

## Troubleshooting

**"API key not found"**
- Ensure `.env` has `OPENROUTER_API_KEY=sk-or-v1-...` or `OPENAI_API_KEY=sk-...`
- Restart the app
- Check that your key is active on the provider's dashboard

**"Backend not running"**
- Check if port 5000 is in use: `netstat -ano | findstr :5000`
- Kill any conflicting process or change `PORT` in `.env`

**"Command blocked by policy"**
- Some dangerous patterns (recursive deletes, system paths) are intentionally blocked
- Reword your request or use PowerShell directly for advanced tasks

**"Command times out"**
- Commands have a 2-minute timeout for safety
- If your command takes longer, break it into smaller steps

---

## FAQ

**Q: Can I use this on Linux/Mac?**  
A: Not yet. It's designed for Windows PowerShell. Contributions welcome!

**Q: What if the LLM generates a wrong command?**  
A: You review it before approving. If policy allows, you can approve anyway.

**Q: Can I add my own policy rules?**  
A: Yes! See `backend/src/policy/policyEngine.js`. Contributions welcome.

**Q: Is this production-safe?**  
A: It's designed for trusted, local use. Don't expose this to untrusted networks.

---

## License

MIT — See [LICENSE](./LICENSE)

---

## More Info

- **Full Technical Spec:** [IMPLEMENTATION_BLUEPRINT.md](./docs/IMPLEMENTATION_BLUEPRINT.md)
- **Architecture Details:** See `docs/` folder
- **Report Issues:** [GitHub Issues](https://github.com/youruser/ai-terminal/issues)

---

**Made with ❤️ for developers who want to run commands safely with AI.**
