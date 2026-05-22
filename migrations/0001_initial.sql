-- Initial schema for AJAR

CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL,
  target_model TEXT NOT NULL,
  attacker_model TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  asr REAL,
  turns INTEGER,
  rollbacks INTEGER,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON eval_runs(status);
CREATE INDEX IF NOT EXISTS idx_eval_runs_algorithm ON eval_runs(algorithm);
CREATE INDEX IF NOT EXISTS idx_eval_runs_created_at ON eval_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS eval_turns (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  branch INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  score REAL,
  rolled_back_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES eval_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_eval_turns_run_id ON eval_turns(run_id);
CREATE INDEX IF NOT EXISTS idx_eval_turns_turn ON eval_turns(turn);
