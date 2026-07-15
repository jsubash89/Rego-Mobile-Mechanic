-- Revocable operator sessions. Only one-way hashes of random cookie session IDs are persisted.
CREATE TABLE operator_sessions (
  session_hash char(64) PRIMARY KEY CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  actor text NOT NULL DEFAULT 'pilot_operator' CHECK (actor = 'pilot_operator'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '8 hours'),
  revoked_at timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at >= issued_at)
);
CREATE INDEX operator_sessions_live_expires_idx ON operator_sessions (expires_at) WHERE revoked_at IS NULL;
CREATE INDEX operator_sessions_revoked_idx ON operator_sessions (revoked_at) WHERE revoked_at IS NOT NULL;
COMMENT ON TABLE operator_sessions IS 'Revocable pilot operator sessions; raw bearer session IDs must never be stored.';

-- Migration-time bounded cleanup. Runtime login and retention operations continue cleanup.
DELETE FROM operator_login_rate_limit_windows
WHERE ctid IN (SELECT ctid FROM operator_login_rate_limit_windows WHERE expires_at <= now() LIMIT 1000);
