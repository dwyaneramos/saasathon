CREATE TABLE users (
  id            SERIAL  PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE,
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
);
