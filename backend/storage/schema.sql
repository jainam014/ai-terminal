CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  user_label TEXT
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

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
);

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
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  llm_provider TEXT,
  llm_model TEXT,
  telemetry_opt_in INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
