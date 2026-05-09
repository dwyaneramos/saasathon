import { getDb } from "../db/index.js";
import type { PublicSpace, Space } from "../types/space.js";

export async function ensureSpaceSchema() {
	await getDb().query(`
		CREATE TABLE IF NOT EXISTS spaces (
			id SERIAL PRIMARY KEY,
			created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
			name TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS document_categories (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
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
			category_id INTEGER REFERENCES document_categories(id) ON DELETE SET NULL,
			confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
			needs_new_category BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
			ADD COLUMN IF NOT EXISTS original_file_name TEXT,
			ADD COLUMN IF NOT EXISTS stored_file_name TEXT,
			ADD COLUMN IF NOT EXISTS storage_path TEXT,
			ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
	`);
}

export function toPublicSpace(space: Space): PublicSpace {
	return {
		id: space.id,
		createdBy: space.created_by,
		name: space.name,
		createdAt: space.created_at,
	};
}

export async function listSpaces() {
	await ensureSpaceSchema();
	const { rows } = await getDb().query<Space>(
		`SELECT id, created_by, name, created_at
		 FROM spaces
		 ORDER BY created_at DESC`,
	);
	return rows;
}

export async function createSpace(input: {
	name: string;
	createdBy?: number | null;
}) {
	await ensureSpaceSchema();
	const { rows } = await getDb().query<Space>(
		`INSERT INTO spaces (name, created_by)
		 VALUES ($1, $2)
		 RETURNING id, created_by, name, created_at`,
		[input.name.trim(), input.createdBy ?? null],
	);
	return rows[0];
}

export async function getSpace(spaceId: number) {
	await ensureSpaceSchema();
	const { rows } = await getDb().query<Space>(
		`SELECT id, created_by, name, created_at
		 FROM spaces
		 WHERE id = $1`,
		[spaceId],
	);
	return rows[0] ?? null;
}

export async function getOrCreateDefaultSpace() {
	await ensureSpaceSchema();
	const existing = await getDb().query<Space>(
		`SELECT id, created_by, name, created_at
		 FROM spaces
		 WHERE name = 'Default Space' AND created_by IS NULL
		 ORDER BY id ASC
		 LIMIT 1`,
	);
	if (existing.rows[0]) {
		return existing.rows[0];
	}

	const { rows } = await getDb().query<Space>(
		`INSERT INTO spaces (name, created_by)
		 VALUES ('Default Space', NULL)
		 RETURNING id, created_by, name, created_at`,
	);
	return rows[0];
}

export async function ensureSpaceExists(spaceId: number) {
	const space = await getSpace(spaceId);
	if (!space) {
		return null;
	}
	return space;
}
