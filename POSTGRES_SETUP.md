# PostgreSQL Setup for Papermerge

## Issue
Docker is having storage issues pulling the PostgreSQL image. Here are solutions:

## Solution 1: Fix Docker Storage Issue

```bash
# Check Docker disk space
docker system df

# Clean up Docker
docker system prune -a

# Try pulling PostgreSQL image again
docker pull postgres:15

# Start PostgreSQL
docker run -d \
  --name papermerge-postgres \
  -e POSTGRES_DB=papermerge \
  -e POSTGRES_USER=papermerge \
  -e POSTGRES_PASSWORD=papermerge \
  -p 5432:5432 \
  postgres:15
```

## Solution 2: Use Docker Compose (once Docker is fixed)

```bash
# Start PostgreSQL
docker compose -f docker-compose.postgres.yml up -d

# Check status
docker ps | grep postgres

# View logs if issues
docker logs papermerge-postgres
```

## Solution 3: Install PostgreSQL Directly (Alternative)

```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE papermerge;
CREATE USER papermerge WITH PASSWORD 'papermerge';
GRANT ALL PRIVILEGES ON DATABASE papermerge TO papermerge;
\q
EOF
```

## Once PostgreSQL is Running

```bash
# Set environment variables
export PAPERMERGE__DATABASE__URL="postgresql://papermerge:papermerge@localhost:5432/papermerge"
export PAPERMERGE__MAIN__MEDIA_ROOT="./media"
export PAPERMERGE__MAIN__API_PREFIX="/api"

# Run migrations (includes password protection fields)
poetry run task migrate

# Start server
poetry run task server
```

## Verify PostgreSQL is Running

```bash
# For Docker
docker ps | grep postgres

# For direct install
sudo systemctl status postgresql

# Test connection
psql -h localhost -U papermerge -d papermerge
# Password: papermerge
```

## Troubleshooting

- **Connection refused**: PostgreSQL not running or not accessible
- **Docker storage error**: Run `docker system prune` to free space
- **Permission denied**: Check Docker permissions or use `sudo` for direct PostgreSQL install

