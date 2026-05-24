# Contributing to AI Terminal

Thanks for your interest in contributing! This guide will help you get started.

---

## Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR-USERNAME/ai-terminal
cd ai-terminal
```

### 2. Local Development Setup

**Backend:**
```bash
cd backend
copy .env.example .env
# Edit .env: add your OpenRouter or OpenAI API key
npm install
npm start
```

**Frontend (in another terminal):**
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

**CLI (in another terminal):**
```bash
cd backend
npm run ai -- "list files in current directory"
```

### 3. Run Tests

```bash
cd backend
npm test

# Watch mode for development
npm test -- --watch
```

---

## Types of Contributions

### 🐛 Bug Fixes
1. Create an issue first (or comment on existing one)
2. Create a branch: `git checkout -b fix/your-bug-name`
3. Write a test that reproduces the bug
4. Fix the bug
5. Run `npm test` — all tests must pass
6. Submit a PR with description of the fix

### ✨ New Features
1. Discuss in an issue first
2. Create a branch: `git checkout -b feat/your-feature-name`
3. Write tests for the new feature
4. Implement the feature
5. Update README if needed
6. Run `npm test` and `npm audit` — must pass
7. Submit a PR

### 📋 New Policy Rules
Want to block more dangerous commands or allow safe ones?

**File:** `backend/src/policy/policyEngine.js`

**Example: Block a new dangerous pattern**
```javascript
const BLOCK_PATTERNS = [
  // ... existing patterns ...
  /(^|\s)sc\s+delete\b/i,  // Block service deletion
];
```

**Example: Add to allowlist**
```javascript
const ALLOWLIST = new Set([
  // ... existing commands ...
  'Get-Hotfix',  // New safe command
]);
```

**Then write a test in `backend/tests/unit/policyEngine.test.js`:**
```javascript
test('blocks service deletion', () => {
  const result = evaluateCommand('sc delete MyService');
  expect(result.allowed).toBe(false);
  expect(result.riskLevel).toBe(RISK_LEVELS.BLOCKED);
});
```

### 📖 Documentation
- Fix typos or unclear sections in README.md
- Improve error messages
- Add more examples

### 🎨 UI/UX Improvements
Edit `frontend/App.jsx`:
- Better styling
- Improved command preview layout
- Better error messages
- More helpful UI hints

---

## Code Style

### Backend (Node.js)
- Use standard Node.js conventions
- Use ES6 where possible
- Quote strings with single quotes: `'string'`
- Use 2-space indentation
- Const/let, no var
- No console.log in production code (use proper logging)

### Frontend (React)
- Use functional components with hooks
- Use camelCase for variables
- CSS inline or minimal (keep it simple)
- Keep components focused and reusable

### No special linting yet, but follow the existing code style

---

## Testing Requirements

**All PRs must:**
1. Have passing tests: `npm test`
2. Have no high/critical vulnerabilities: `npm audit`
3. Cover new code (aim for >80% coverage on new modules)

**Testing checklist before submitting:**
```bash
cd backend

# Run all tests
npm test

# Check for security issues
npm audit

# Test the API manually
npm start &
curl -X POST http://localhost:5000/propose \
  -H "Content-Type: application/json" \
  -d '{"message":"list files"}'
```

---

## Commit Messages

Keep them clear and concise:

- ✅ `fix: block reg add command in policy engine`
- ✅ `feat: add streaming output support to frontend`
- ✅ `docs: clarify policy rules in README`
- ❌ `fixed stuff`
- ❌ `update`

---

## PR Checklist

Before submitting a pull request:

- [ ] Code follows the existing style
- [ ] Tests pass: `npm test`
- [ ] No security warnings: `npm audit`
- [ ] README updated (if needed)
- [ ] Commit messages are clear
- [ ] No console.logs or debug code left
- [ ] Related issue is referenced (if applicable)

---

## PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
How to test these changes:
1. Start backend
2. Run the CLI: `npm run ai -- "..."`
3. Check that X works correctly

## Related Issue
Closes #123
```

---

## Areas We're Looking For Help

1. **Tests** — expand test coverage
2. **macOS/Linux support** — adapt for PowerShell Core
3. **Deterministic rules** — add more patterns to avoid LLM calls
4. **Policy rules** — help us identify more dangerous patterns
5. **UI/UX** — improve the frontend experience
6. **Documentation** — clarify anything confusing

---

## Questions?

- Open an issue on GitHub
- Check existing issues for similar questions
- Read [IMPLEMENTATION_BLUEPRINT.md](./docs/IMPLEMENTATION_BLUEPRINT.md) for architecture details

---

## Code of Conduct

Be respectful, inclusive, and constructive. We're building this together!

---

**Thank you for contributing! 🙏**
