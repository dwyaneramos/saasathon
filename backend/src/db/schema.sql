CREATE TABLE users (
  id            SERIAL  PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE,
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE spaces (
  id         SERIAL PRIMARY KEY,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  space_id    INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
  metadata    JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX document_categories_space_name_unique_idx
  ON document_categories (COALESCE(space_id, 0), lower(name));

CREATE TABLE documents (
  id                 SERIAL PRIMARY KEY,
  space_id           INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
  filename           TEXT NOT NULL,
  filepath           TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}',
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

