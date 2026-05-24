require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { proposeFromUserMessage, getProposal } = require('./src/orchestrator/orchestrator');
const { executePowerShell, executePowerShellStream } = require('./src/execution/powershellExecutor');
const { appendAudit, initAuditDb } = require('./src/audit/auditService');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  return res.json({ ok: true, service: 'ai-terminal-backend' });
});

app.post('/propose', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const proposal = await proposeFromUserMessage(message);
    await appendAudit({ type: 'proposal', proposal });

    return res.json({ proposal });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to propose command' });
  }
});

app.post('/execute-approved', async (req, res) => {
  try {
    const proposalId = String(req.body?.proposalId || '').trim();
    if (!proposalId) {
      return res.status(400).json({ error: 'proposalId is required' });
    }

    const proposal = getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'proposal not found' });
    }

    if (!proposal.policy.allowed) {
      await appendAudit({
        type: 'blocked_execution_attempt',
        proposalId,
        command: proposal.command,
        reasons: proposal.policy.reasons,
      });
      return res.status(403).json({ error: 'Command blocked by policy', reasons: proposal.policy.reasons });
    }

    const result = await executePowerShell(proposal.command);
    await appendAudit({ type: 'execution', proposalId, command: proposal.command, result });

    return res.json({
      proposalId,
      command: proposal.command,
      result,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Execution failed' });
  }
});

app.post('/execute-approved-stream', async (req, res) => {
  const sendEvent = (event, payload) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const proposalId = String(req.body?.proposalId || '').trim();
    if (!proposalId) {
      sendEvent('error', { error: 'proposalId is required' });
      res.end();
      return;
    }

    const proposal = getProposal(proposalId);
    if (!proposal) {
      sendEvent('error', { error: 'proposal not found' });
      res.end();
      return;
    }

    if (!proposal.policy.allowed) {
      await appendAudit({
        type: 'blocked_execution_attempt',
        proposalId,
        command: proposal.command,
        reasons: proposal.policy.reasons,
      });
      sendEvent('blocked', {
        error: 'Command blocked by policy',
        reasons: proposal.policy.reasons,
      });
      res.end();
      return;
    }

    sendEvent('start', {
      proposalId,
      command: proposal.command,
    });

    const execution = executePowerShellStream(proposal.command, {
      onStdout: (chunk) => sendEvent('stdout', { chunk }),
      onStderr: (chunk) => sendEvent('stderr', { chunk }),
    });

    res.on('close', () => {
      if (!res.writableEnded) {
        execution.cancel();
      }
    });

    const result = await execution.resultPromise;
    await appendAudit({ type: 'execution', proposalId, command: proposal.command, result });

    sendEvent('end', {
      proposalId,
      command: proposal.command,
      result,
    });
    res.end();
  } catch (error) {
    sendEvent('error', { error: error.message || 'Execution failed' });
    res.end();
  }
});

const PORT = process.env.PORT || 5000;
initAuditDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize audit database', error);
    process.exit(1);
  });
