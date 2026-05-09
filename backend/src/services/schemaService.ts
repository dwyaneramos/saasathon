import { getDb } from "../db/index.js";

let coreSchemaReady = false;
let coreSchemaPromise: Promise<void> | null = null;

export async function ensureCoreSchema() {
  if (coreSchemaReady) {
    return;
  }

  if (!coreSchemaPromise) {
    coreSchemaPromise = getDb()
      .query(`
        CREATE TABLE IF NOT EXISTS spaces (
          id SERIAL PRIMARY KEY,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS spaces_created_by_unique_idx
          ON spaces(created_by)
          WHERE created_by IS NOT NULL;

        CREATE TABLE IF NOT EXISTS document_categories (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
          metadata JSONB NOT NULL DEFAULT '{}',
          description TEXT,
          keywords TEXT[] NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS documents (
          id SERIAL PRIMARY KEY,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          page_count INTEGER NOT NULL DEFAULT 0,
          extracted_text TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          keywords TEXT[] NOT NULL DEFAULT '{}',
          category_id INTEGER REFERENCES document_categories(id) ON DELETE SET NULL,
          confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
          needs_new_category BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE documents
          ADD COLUMN IF NOT EXISTS space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
          ADD COLUMN IF NOT EXISTS filename TEXT NOT NULL DEFAULT 'unknown',
          ADD COLUMN IF NOT EXISTS filepath TEXT,
          ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}',
          ADD COLUMN IF NOT EXISTS original_file_name TEXT,
          ADD COLUMN IF NOT EXISTS stored_file_name TEXT,
          ADD COLUMN IF NOT EXISTS storage_path TEXT,
          ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;

        ALTER TABLE document_categories
          DROP CONSTRAINT IF EXISTS document_categories_name_key,
          ADD COLUMN IF NOT EXISTS space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
          ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

        UPDATE document_categories
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
          'description', description,
          'keywords', keywords
        ));

        UPDATE documents
        SET keywords = COALESCE((
          SELECT ARRAY(
            SELECT DISTINCT token
            FROM unnest(
              regexp_split_to_array(
                regexp_replace(lower(COALESCE(original_file_name, file_name, filename, '')), '\\.[^.]+$', ''),
                '[^a-z0-9]+'
              )
            ) AS token
            WHERE length(token) >= 3
            ORDER BY token
          )
        ), '{}'::text[])
        WHERE cardinality(COALESCE(keywords, '{}'::text[])) = 0;

        UPDATE documents
        SET
          filename = COALESCE(NULLIF(filename, ''), stored_file_name, file_name, 'unknown'),
          filepath = COALESCE(filepath, storage_path),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
            'originalName', original_file_name,
            'mimeType', mime_type,
            'size', file_size,
            'spaceId', space_id,
            'keywords', keywords
          ));

        CREATE UNIQUE INDEX IF NOT EXISTS document_categories_space_name_unique_idx
          ON document_categories (COALESCE(space_id, 0), lower(name));

        CREATE INDEX IF NOT EXISTS documents_keywords_gin_idx
          ON documents
          USING GIN (keywords);
      `)
      .then(() => {
        coreSchemaReady = true;
      })
      .catch((error) => {
        coreSchemaPromise = null;
        throw error;
      });
  }

  await coreSchemaPromise;
}
