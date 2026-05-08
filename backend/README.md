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
