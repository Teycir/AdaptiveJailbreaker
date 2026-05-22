-- Add scorer_model column that was missing from the initial schema.
-- Both runner.ts and results.ts INSERT this column; without it every
-- completed eval and every GET /results returns a D1 SQLITE_ERROR 500.

ALTER TABLE eval_runs ADD COLUMN scorer_model TEXT;
