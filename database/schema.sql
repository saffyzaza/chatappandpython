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

INSERT INTO accounts (name, email, password_hash, role, status) VALUES
('musya01', 'musya01@gmail.com', crypt('1234musya01', gen_salt('bf', 12)), 'user', 'approved'),
('musya02', 'musya02@gmail.com', crypt('1234musya02', gen_salt('bf', 12)), 'user', 'approved'),
('musya03', 'musya03@gmail.com', crypt('1234musya03', gen_salt('bf', 12)), 'user', 'approved'),
('musya04', 'musya04@gmail.com', crypt('1234musya04', gen_salt('bf', 12)), 'user', 'approved'),
('musya05', 'musya05@gmail.com', crypt('1234musya05', gen_salt('bf', 12)), 'user', 'approved'),
('musya06', 'musya06@gmail.com', crypt('1234musya06', gen_salt('bf', 12)), 'user', 'approved'),
('musya07', 'musya07@gmail.com', crypt('1234musya07', gen_salt('bf', 12)), 'user', 'approved'),
('musya08', 'musya08@gmail.com', crypt('1234musya08', gen_salt('bf', 12)), 'user', 'approved'),
('musya09', 'musya09@gmail.com', crypt('1234musya09', gen_salt('bf', 12)), 'user', 'approved'),
('musya10', 'musya10@gmail.com', crypt('1234musya10', gen_salt('bf', 12)), 'user', 'approved'),
('musya11', 'musya11@gmail.com', crypt('1234musya11', gen_salt('bf', 12)), 'user', 'approved'),
('musya12', 'musya12@gmail.com', crypt('1234musya12', gen_salt('bf', 12)), 'user', 'approved'),
('musya13', 'musya13@gmail.com', crypt('1234musya13', gen_salt('bf', 12)), 'user', 'approved'),
('musya14', 'musya14@gmail.com', crypt('1234musya14', gen_salt('bf', 12)), 'user', 'approved'),
('musya15', 'musya15@gmail.com', crypt('1234musya15', gen_salt('bf', 12)), 'user', 'approved'),
('musya16', 'musya16@gmail.com', crypt('1234musya16', gen_salt('bf', 12)), 'user', 'approved'),
('musya17', 'musya17@gmail.com', crypt('1234musya17', gen_salt('bf', 12)), 'user', 'approved'),
('musya18', 'musya18@gmail.com', crypt('1234musya18', gen_salt('bf', 12)), 'user', 'approved'),
('musya19', 'musya19@gmail.com', crypt('1234musya19', gen_salt('bf', 12)), 'user', 'approved'),
('musya20', 'musya20@gmail.com', crypt('1234musya20', gen_salt('bf', 12)), 'user', 'approved'),
('musya21', 'musya21@gmail.com', crypt('1234musya21', gen_salt('bf', 12)), 'user', 'approved'),
('musya22', 'musya22@gmail.com', crypt('1234musya22', gen_salt('bf', 12)), 'user', 'approved'),
('musya23', 'musya23@gmail.com', crypt('1234musya23', gen_salt('bf', 12)), 'user', 'approved'),
('musya24', 'musya24@gmail.com', crypt('1234musya24', gen_salt('bf', 12)), 'user', 'approved'),
('musya25', 'musya25@gmail.com', crypt('1234musya25', gen_salt('bf', 12)), 'user', 'approved'),
('musya26', 'musya26@gmail.com', crypt('1234musya26', gen_salt('bf', 12)), 'user', 'approved'),
('musya27', 'musya27@gmail.com', crypt('1234musya27', gen_salt('bf', 12)), 'user', 'approved'),
('musya28', 'musya28@gmail.com', crypt('1234musya28', gen_salt('bf', 12)), 'user', 'approved'),
('musya29', 'musya29@gmail.com', crypt('1234musya29', gen_salt('bf', 12)), 'user', 'approved'),
('musya30', 'musya30@gmail.com', crypt('1234musya30', gen_salt('bf', 12)), 'user', 'approved'),
('musya31', 'musya31@gmail.com', crypt('1234musya31', gen_salt('bf', 12)), 'user', 'approved'),
('musya32', 'musya32@gmail.com', crypt('1234musya32', gen_salt('bf', 12)), 'user', 'approved'),
('musya33', 'musya33@gmail.com', crypt('1234musya33', gen_salt('bf', 12)), 'user', 'approved'),
('musya34', 'musya34@gmail.com', crypt('1234musya34', gen_salt('bf', 12)), 'user', 'approved'),
('musya35', 'musya35@gmail.com', crypt('1234musya35', gen_salt('bf', 12)), 'user', 'approved'),
('musya36', 'musya36@gmail.com', crypt('1234musya36', gen_salt('bf', 12)), 'user', 'approved'),
('musya37', 'musya37@gmail.com', crypt('1234musya37', gen_salt('bf', 12)), 'user', 'approved'),
('musya38', 'musya38@gmail.com', crypt('1234musya38', gen_salt('bf', 12)), 'user', 'approved'),
('musya39', 'musya39@gmail.com', crypt('1234musya39', gen_salt('bf', 12)), 'user', 'approved'),
('musya40', 'musya40@gmail.com', crypt('1234musya40', gen_salt('bf', 12)), 'user', 'approved'),
('musya41', 'musya41@gmail.com', crypt('1234musya41', gen_salt('bf', 12)), 'user', 'approved'),
('musya42', 'musya42@gmail.com', crypt('1234musya42', gen_salt('bf', 12)), 'user', 'approved'),
('musya43', 'musya43@gmail.com', crypt('1234musya43', gen_salt('bf', 12)), 'user', 'approved'),
('musya44', 'musya44@gmail.com', crypt('1234musya44', gen_salt('bf', 12)), 'user', 'approved'),
('musya45', 'musya45@gmail.com', crypt('1234musya45', gen_salt('bf', 12)), 'user', 'approved'),
('musya46', 'musya46@gmail.com', crypt('1234musya46', gen_salt('bf', 12)), 'user', 'approved'),
('musya47', 'musya47@gmail.com', crypt('1234musya47', gen_salt('bf', 12)), 'user', 'approved'),
('musya48', 'musya48@gmail.com', crypt('1234musya48', gen_salt('bf', 12)), 'user', 'approved'),
('musya49', 'musya49@gmail.com', crypt('1234musya49', gen_salt('bf', 12)), 'user', 'approved'),
('musya50', 'musya50@gmail.com', crypt('1234musya50', gen_salt('bf', 12)), 'user', 'approved');