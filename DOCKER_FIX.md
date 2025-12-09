
## Docker Issue Fix

The Docker error 'no such file or directory' in /var/lib/docker/tmp suggests a Docker daemon issue.

**Quick Fix (requires sudo):**

```bash
# 1. Restart Docker daemon
sudo systemctl restart docker

# 2. Fix tmp directory permissions (if needed)
sudo chmod 755 /var/lib/docker/tmp
sudo chown root:root /var/lib/docker/tmp

# 3. Pull PostgreSQL image
docker pull postgres:15

# 4. Start PostgreSQL
docker run -d \
  --name papermerge-postgres \
  -e POSTGRES_DB=papermerge \
  -e POSTGRES_USER=papermerge \
  -e POSTGRES_PASSWORD=papermerge \
  -p 5432:5432 \
  postgres:15

# 5. Verify it's running
docker ps | grep postgres
```

**Alternative: Install PostgreSQL directly (no Docker needed)**

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres psql << EOF
CREATE DATABASE papermerge;
CREATE USER papermerge WITH PASSWORD 'papermerge';
GRANT ALL PRIVILEGES ON DATABASE papermerge TO papermerge;
EOF
```

