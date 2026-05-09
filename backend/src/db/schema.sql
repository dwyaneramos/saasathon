CREATE TABLE users (
  id            SERIAL  PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE,
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
  id                 SERIAL PRIMARY KEY,
  file_name          TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  page_count         INTEGER NOT NULL DEFAULT 0,
  extracted_text     TEXT NOT NULL,
  summary            TEXT NOT NULL,
  category_id        INTEGER REFERENCES document_categories(id) ON DELETE SET NULL,
  confidence         NUMERIC(5, 4) NOT NULL DEFAULT 0,
  needs_new_category BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE space (
  id          SERIAL PRIMARY KEY,
  created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
