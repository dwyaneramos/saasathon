import { Pool } from "pg";

let _db: Pool | null = null;

export function getDb(): Pool {
	if (!_db) {
		_db = new Pool({
			user: process.env.POSTGRES_USER,
			password: process.env.POSTGRES_PASSWORD,
			database: process.env.POSTGRES_DB,
			host: "localhost",
			port: 5432,
		});
	}
	return _db;
}
