import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Set mock provider for tests
process.env.LLM_PROVIDER = 'mock';

const { proposeFromUserMessage } = await import('../../src/orchestrator/orchestrator.js');

describe('POST /propose Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    app.post('/propose', async (req, res) => {
      try {
        const message = String(req.body?.message || '').trim();
        if (!message) {
          return res.status(400).json({ error: 'message is required' });
        }

        const proposal = await proposeFromUserMessage(message);
        return res.json({ proposal });
      } catch (error) {
        return res
          .status(500)
          .json({ error: error.message || 'Failed to propose command' });
      }
    });

    app.get('/health', (_req, res) => {
      res.json({ ok: true });
    });

    server = app.listen(0); // Use any available port
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it('returns 200 with proposal structure for valid message', async () => {
    const res = await request(app)
      .post('/propose')
      .send({ message: 'list files in current directory' })
      .expect(200);

    expect(res.body.proposal).toBeDefined();
    expect(res.body.proposal.id).toBeDefined();
    expect(res.body.proposal.intent).toBeDefined();
    expect(res.body.proposal.command).toBeDefined();
    expect(res.body.proposal.riskLevel).toBeDefined();
    expect(res.body.proposal.policy).toBeDefined();
    expect(res.body.proposal.policy.allowed).toBeDefined();
  });

  it('returns 400 for empty message', async () => {
    const res = await request(app)
      .post('/propose')
      .send({ message: '' })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for missing message field', async () => {
    const res = await request(app).post('/propose').send({}).expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('deterministic trigger returns Get-Location for "current working directory"', async () => {
    const res = await request(app)
      .post('/propose')
      .send({ message: 'show me the current working directory' })
      .expect(200);

    expect(res.body.proposal.command).toBe('Get-Location');
    expect(res.body.proposal.riskLevel).toBe('SAFE_READ');
  });

  it('blocked command results in policy.allowed = false', async () => {
    const res = await request(app)
      .post('/propose')
      .send({ message: 'delete all files recursively' })
      .expect(200);

    expect(res.body.proposal.policy.allowed).toBe(false);
    expect(res.body.proposal.policy.riskLevel).toBe('BLOCKED');
  });
});
