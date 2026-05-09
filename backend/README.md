# Docker Setup

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## First-time setup

```bash
cp .env.example .env
```

Edit `.env` with your credentials, then:

```bash
docker compose up -d
```

## Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f db

# Restart
docker compose restart db

# Wipe database and start fresh
docker compose down -v && docker compose up -d
```

## Verify

```bash
docker compose ps          # check status
docker compose exec db psql -U appuser -d appdb -c "\dt"  # list tables
```

## Document analysis API

The backend accepts PDF and image uploads, asks Claude through OpenRouter to parse them, and scores the result against saved categories.

Required environment:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5
OPENROUTER_PDF_ENGINE=cloudflare-ai
```

```bash
curl -F "file=@example.pdf" http://localhost:3000/api/v1/documents/analyze
```

```bash
curl -F "file=@example.png" http://localhost:3000/api/v1/images/analyze
```

If no category is confident enough, the response returns `needsNewCategory: true`, a `suggestedCategoryName`, and a `prompt` message for creating one.

```bash
curl -X POST http://localhost:3000/api/v1/categories \
  -H "Content-Type: application/json" \
  -d '{"name":"Grant Applications","keywords":["grant","application","funding"],"documentId":1}'
```

The legacy `POST /upload` endpoint is also wired to the same analyzer for the current upload page.
