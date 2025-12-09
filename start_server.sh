#!/bin/bash
# Start Papermerge server with PostgreSQL

export PAPERMERGE__DATABASE__URL="postgresql://papermerge:papermerge@localhost:5432/papermerge"
export PAPERMERGE__MAIN__MEDIA_ROOT="./media"
export PAPERMERGE__MAIN__API_PREFIX="/api"

echo "Starting Papermerge server..."
echo "Database: $PAPERMERGE__DATABASE__URL"
echo "Media Root: $PAPERMERGE__MAIN__MEDIA_ROOT"
echo ""
echo "Server will be available at: http://localhost:8000"
echo "API docs at: http://localhost:8000/docs"
echo ""

poetry run task server
