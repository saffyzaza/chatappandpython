-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  role             VARCHAR(50)  NOT NULL DEFAULT 'user',       -- 'user' | 'admin' | 'adminsuper'
  status           VARCHAR(50)  NOT NULL DEFAULT 'pending',    -- 'pending' | 'approved' | 'rejected'
  approved_by      UUID         REFERENCES accounts(id),
  approved_at      TIMESTAMPTZ,

  -- Profile fields
  prefix           VARCHAR(50),
  organization     VARCHAR(255),
  position         VARCHAR(255),
  department       VARCHAR(255),
  phone            VARCHAR(50),
  province         VARCHAR(100),
  health_zone      VARCHAR(100),
  parent_organization VARCHAR(255),
  org_code         VARCHAR(100),
  address          TEXT,
  website          VARCHAR(255),

  -- Password reset
  reset_token          VARCHAR(255),
  reset_token_expires  TIMESTAMPTZ,

  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS accounts_email_idx        ON accounts(email);
CREATE INDEX IF NOT EXISTS accounts_status_idx       ON accounts(status);
CREATE INDEX IF NOT EXISTS accounts_reset_token_idx  ON accounts(reset_token);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS accounts_updated_at ON accounts;
CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Chat session history
CREATE TABLE IF NOT EXISTS chat_sessions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       TEXT         NOT NULL UNIQUE,
  user_id          UUID         REFERENCES accounts(id) ON DELETE SET NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'idle',
  last_user_prompt TEXT,
  messages_json    JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx ON chat_sessions(updated_at DESC);

DROP TRIGGER IF EXISTS chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed first admin account (change password after first login)
-- INSERT INTO accounts (name, email, password_hash, role, status)
-- VALUES ('Admin', 'admin@example.com', '$2a$12$...', 'admin', 'approved');

-- Journal Reports — saved HTML reports from ThaiJo pipeline
CREATE TABLE IF NOT EXISTS journal_reports (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title         TEXT         NOT NULL,
  query         TEXT         NOT NULL,
  doc_type      VARCHAR(20)  NOT NULL DEFAULT 'policy',
  article_count INT          NOT NULL DEFAULT 0,
  topic_plan    TEXT         NOT NULL DEFAULT '',
  html_content  TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_reports_user_id_idx    ON journal_reports(user_id);
CREATE INDEX IF NOT EXISTS journal_reports_created_at_idx ON journal_reports(created_at DESC);

DROP TRIGGER IF EXISTS journal_reports_updated_at ON journal_reports;
CREATE TRIGGER journal_reports_updated_at
  BEFORE UPDATE ON journal_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


INSERT INTO accounts (name, email, password_hash, role, status)
VALUES (
  'Admin',
  'musya@gmail.com',
  crypt('123456musya', gen_salt('bf', 12)),
  'admin',
  'approved'
);
INSERT INTO accounts (name, email, password_hash, role, status)
VALUES (
  'Adminsuper',
  'supermusya@gmail.com',
  crypt('123456musya', gen_salt('bf', 12)),
  'adminsuper',
  'approved'
);