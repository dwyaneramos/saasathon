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

CREATE TABLE spaces (
  id         SERIAL PRIMARY KEY,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
  id                 SERIAL PRIMARY KEY,
  space_id           INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
  file_name          TEXT NOT NULL,
  original_file_name TEXT,
  stored_file_name   TEXT,
  storage_path       TEXT,
  mime_type          TEXT NOT NULL,
  file_size          INTEGER NOT NULL DEFAULT 0,
  page_count         INTEGER NOT NULL DEFAULT 0,
  extracted_text     TEXT NOT NULL,
  summary            TEXT NOT NULL,
  category_id        INTEGER REFERENCES document_categories(id) ON DELETE SET NULL,
  confidence         NUMERIC(5, 4) NOT NULL DEFAULT 0,
  needs_new_category BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
