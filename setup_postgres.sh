#!/bin/bash
# Setup script for PostgreSQL with Papermerge

echo "Setting up PostgreSQL for Papermerge..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install it:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "  Or use Docker: docker run -d --name papermerge-postgres -e POSTGRES_DB=papermerge -e POSTGRES_USER=papermerge -e POSTGRES_PASSWORD=papermerge -p 5432:5432 postgres:16"
    exit 1
fi

# Create database and user (requires PostgreSQL to be running)
echo "Creating database and user..."
sudo -u postgres psql << EOF
CREATE DATABASE papermerge;
CREATE USER papermerge WITH PASSWORD 'papermerge';
GRANT ALL PRIVILEGES ON DATABASE papermerge TO papermerge;
\q
EOF

echo "PostgreSQL setup complete!"
echo ""
echo "Set these environment variables:"
echo "  export PAPERMERGE__DATABASE__URL='postgresql://papermerge:papermerge@localhost:5432/papermerge'"
echo "  export PAPERMERGE__MAIN__MEDIA_ROOT='./media'"
echo "  export PAPERMERGE__MAIN__API_PREFIX='/api'"
echo ""
echo "Then run: poetry run task migrate"

