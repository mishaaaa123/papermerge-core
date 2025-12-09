## Quick Start Commands

# 1. Fix Docker and start PostgreSQL:
docker system prune -a
docker pull postgres:15
docker run -d --name papermerge-postgres -e POSTGRES_DB=papermerge -e POSTGRES_USER=papermerge -e POSTGRES_PASSWORD=papermerge -p 5432:5432 postgres:15

# 2. Wait 5-10 seconds, then verify:
docker ps | grep postgres

# 3. Set environment and run migrations:
export PAPERMERGE__DATABASE__URL='postgresql://papermerge:papermerge@localhost:5432/papermerge'
export PAPERMERGE__MAIN__MEDIA_ROOT='./media'
export PAPERMERGE__MAIN__API_PREFIX='/api'
poetry run task migrate

# 4. Start server:
poetry run task server

