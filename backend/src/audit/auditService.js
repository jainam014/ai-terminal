const crypto = require('crypto');
const path = require('path');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();

const STORAGE_DIR = path.join(os.homedir(), '.ai-terminal');
const AUDIT_DB_PATH = path.join(STORAGE_DIR, 'audit.db');

let db;
let initPromise;

function createDatabase() {
  if (db) {
    return db;
  }

  db = new sqlite3.Database(AUDIT_DB_PATH);
  return db;
}

function run(sql, params = []) {
  const database = createDatabase();
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  const database = createDatabase();
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

async function initAuditDb() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const fs = require('fs');
    fs.mkdirSync(STORAGE_DIR, { recursive: true });

    await run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        user_label TEXT
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        prompt_id TEXT NOT NULL,
        intent TEXT,
        command TEXT NOT NULL,
        risk_level TEXT,
        confidence REAL,
        explanation TEXT,
        created_at TEXT NOT NULL,
        source TEXT,
        policy_json TEXT,
        needs_confirmation INTEGER,
        FOREIGN KEY(prompt_id) REFERENCES prompts(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        approved INTEGER NOT NULL,
        status TEXT NOT NULL,
        exit_code INTEGER,
        stdout TEXT,
        stderr TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        command TEXT,
        FOREIGN KEY(proposal_id) REFERENCES proposals(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        llm_provider TEXT,
        llm_model TEXT,
        telemetry_opt_in INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  })();

  return initPromise;
}

async function ensureDefaultSession() {
  await initAuditDb();

  const existing = await get('SELECT id FROM sessions WHERE id = ?', ['default']);
  if (existing && existing.id) {
    return existing.id;
  }

  await run('INSERT INTO sessions(id, started_at, user_label) VALUES (?, ?, ?)', [
    'default',
    new Date().toISOString(),
    'Default Session',
  ]);
  return 'default';
}

async function logProposal(proposal) {
  await initAuditDb();

  const sessionId = await ensureDefaultSession();
  const promptId = crypto.randomUUID();

  await run('INSERT INTO prompts(id, session_id, text, created_at) VALUES (?, ?, ?, ?)', [
    promptId,
    sessionId,
    String(proposal.userMessage || ''),
    String(proposal.createdAt || new Date().toISOString()),
  ]);

  await run(
    `
    INSERT INTO proposals(
      id, prompt_id, intent, command, risk_level, confidence, explanation,
      created_at, source, policy_json, needs_confirmation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      String(proposal.id),
      promptId,
      String(proposal.intent || ''),
      String(proposal.command || ''),
      String(proposal.riskLevel || ''),
      Number.isFinite(proposal.confidence) ? proposal.confidence : null,
      String(proposal.explanation || ''),
      String(proposal.createdAt || new Date().toISOString()),
      String(proposal.source || ''),
      JSON.stringify(proposal.policy || {}),
      proposal.needsConfirmation ? 1 : 0,
    ]
  );
}

async function logExecution({ proposalId, command, result }) {
  await initAuditDb();

  const now = new Date().toISOString();
  await run(
    `
    INSERT INTO executions(
      id, proposal_id, approved, status, exit_code, stdout, stderr, started_at, ended_at, command
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      String(proposalId),
      1,
      result && result.ok ? 'SUCCESS' : 'FAILED',
      result && Number.isInteger(result.exitCode) ? result.exitCode : null,
      String((result && result.stdout) || ''),
      String((result && result.stderr) || ''),
      now,
      now,
      String(command || ''),
    ]
  );
}

async function logBlockedExecutionAttempt({ proposalId, command, reasons }) {
  await initAuditDb();

  const now = new Date().toISOString();
  await run(
    `
    INSERT INTO executions(
      id, proposal_id, approved, status, exit_code, stdout, stderr, started_at, ended_at, command
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      String(proposalId),
      0,
      'BLOCKED',
      null,
      '',
      Array.isArray(reasons) ? reasons.join('; ') : 'Blocked by policy',
      now,
      now,
      String(command || ''),
    ]
  );
}

async function logRawEvent(event) {
  await initAuditDb();
  await run('INSERT INTO audit_events(id, type, payload_json, created_at) VALUES (?, ?, ?, ?)', [
    crypto.randomUUID(),
    String(event.type || 'unknown'),
    JSON.stringify(event || {}),
    new Date().toISOString(),
  ]);
}

async function appendAudit(event) {
  const kind = String(event && event.type ? event.type : '').trim();

  if (kind === 'proposal' && event.proposal) {
    await logProposal(event.proposal);
    return;
  }

  if (kind === 'execution') {
    await logExecution(event);
    return;
  }

  if (kind === 'blocked_execution_attempt') {
    await logBlockedExecutionAttempt(event);
    return;
  }

  await logRawEvent(event);
}

module.exports = {
  initAuditDb,
  logProposal,
  logExecution,
  logBlockedExecutionAttempt,
  appendAudit,
  AUDIT_DB_PATH,
};
