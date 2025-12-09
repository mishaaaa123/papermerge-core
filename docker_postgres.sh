#!/bin/bash
# Script to start PostgreSQL with Docker for Papermerge

echo "Starting PostgreSQL container..."

# Stop and remove existing container if it exists
docker stop papermerge-postgres 2>/dev/null
docker rm papermerge-postgres 2>/dev/null

# Start PostgreSQL container
docker run -d \
  --name papermerge-postgres \
  -e POSTGRES_DB=papermerge \
  -e POSTGRES_USER=papermerge \
  -e POSTGRES_PASSWORD=papermerge \
  -p 5432:5432 \
  postgres:15

echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Check if container is running
if docker ps | grep -q papermerge-postgres; then
    echo "✓ PostgreSQL container is running"
    echo ""
    echo "Database connection string:"
    echo "  postgresql://papermerge:papermerge@localhost:5432/papermerge"
    echo ""
    echo "To run migrations:"
    echo "  export PAPERMERGE__DATABASE__URL='postgresql://papermerge:papermerge@localhost:5432/papermerge'"
    echo "  export PAPERMERGE__MAIN__MEDIA_ROOT='./media'"
    echo "  export PAPERMERGE__MAIN__API_PREFIX='/api'"
    echo "  poetry run task migrate"
else
    echo "✗ Container failed to start. Check logs with: docker logs papermerge-postgres"
fi
