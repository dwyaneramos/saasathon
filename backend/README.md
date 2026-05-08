### Backend

# PostgreSQL Docker Setup

A Docker Compose setup for running a PostgreSQL database locally for your Express app.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

## Getting Started

### 1. Configure environment variables

Copy the example env file and edit your credentials:

```bash
cp .env.example .env
```

Open `.env` and update `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` to your liking. Copy the resulting `DATABASE_URL` into your Express app's `.env`.

### 2. (Optional) Add initial schema

Edit `init.sql` to create tables or seed data on first startup. This file only runs when the volume is brand new.

### 3. Start the database

```bash
docker compose up -d
```

The `-d` flag runs the container in the background. Postgres will be available at `localhost:5432`.

### 4. Stop the database

```bash
docker compose down
```

This stops and removes the container but **preserves your data** in the `postgres_data` volume.

To also delete all stored data (full reset):

```bash
docker compose down -v
```

## Connecting from Express

Install a Postgres client:

```bash
npm install pg
# or with an ORM:
npm install prisma
npm install drizzle-orm postgres
```

Example using `pg`:

```js
import { Pool } from "pg";

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
});

export default pool;
```

## Useful Commands

| Task                      | Command                                           |
| ------------------------- | ------------------------------------------------- |
| Start (background)        | `docker compose up -d`                            |
| Stop                      | `docker compose down`                             |
| View logs                 | `docker compose logs -f db`                       |
| Open psql shell           | `docker compose exec db psql -U appuser -d appdb` |
| Full reset (deletes data) | `docker compose down -v`                          |

## File Overview

```
.
├── docker-compose.yml   # Defines the Postgres service
├── .env.example         # Template for credentials (commit this)
├── .env                 # Your actual credentials (do NOT commit)
└── init.sql             # Runs once on first startup
```

> **Note:** Add `.env` to your `.gitignore` — never commit real credentials.
