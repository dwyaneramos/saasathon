import { getDb } from "../db/index.js";
import type { PublicSpace, Space } from "../types/space.js";
import { ensureCoreSchema } from "./schemaService.js";

export async function ensureSpaceSchema() {
	await ensureCoreSchema();
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

export async function listSpacesForUser(userId: number) {
	await ensureSpaceSchema();
	const { rows } = await getDb().query<Space>(
		`SELECT id, created_by, name, created_at
		 FROM spaces
		 WHERE created_by = $1
		 ORDER BY created_at DESC`,
		[userId],
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

export async function getOrCreateUserSpace(input: {
	userId: number;
	name?: string;
}) {
	await ensureSpaceSchema();
	const existing = await getDb().query<Space>(
		`SELECT id, created_by, name, created_at
		 FROM spaces
		 WHERE created_by = $1
		 ORDER BY id ASC
		 LIMIT 1`,
		[input.userId],
	);
	if (existing.rows[0]) {
		return existing.rows[0];
	}

	const { rows } = await getDb().query<Space>(
		`INSERT INTO spaces (name, created_by)
		 VALUES ($1, $2)
		 RETURNING id, created_by, name, created_at`,
		[input.name?.trim() || "My Space", input.userId],
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
