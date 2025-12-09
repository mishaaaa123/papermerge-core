# Papermerge Login Details

## Default Login Credentials

Based on `docker-compose.yml` configuration:

**Username:** `admin`  
**Password:** `1234`

## Authentication Method

Papermerge uses **OAuth2 Password Grant** flow with JWT tokens.

## How to Get a Token

### Option 1: Use the Auth Server (if running)
The auth server should be accessible at:
```
POST http://localhost:8080/api/auth/token/
Content-Type: application/x-www-form-urlencoded

username=admin&password=1234
```

### Option 2: Generate Token via CLI
```bash
docker compose exec webapp poetry run paper-cli token encode admin
```

This will generate a JWT token payload that you can use.

### Option 3: Use Swagger UI
1. Open `http://localhost:8080/docs` in your browser
2. Click the "Authorize" button (lock icon)
3. Enter:
   - Username: `admin`
   - Password: `1234`
4. Click "Authorize"
5. You can now test all API endpoints

## Database Users

To check existing users:
```bash
docker compose exec webapp poetry run paper-cli users ls
```

## Create New User

```bash
docker compose exec webapp poetry run paper-cli users create \
  --username <username> \
  --email <email> \
  --password <password> \
  --superuser
```

## Notes

- The admin user is created automatically during Docker initialization
- Password is hashed using `pbkdf2_sha256` (passlib)
- Tokens are JWT format with base64-encoded payload
- Most API endpoints require authentication via Bearer token

