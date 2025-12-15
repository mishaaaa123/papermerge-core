# How to Call Shared Documents API

## Method 1: Using Browser (Easiest)

1. **Open your browser** and navigate to `http://localhost:8080`
2. **Login** as "misha" (or any user)
3. **Open Developer Tools** (F12)
4. **Go to Network tab**
5. **Navigate to a shared document** in the UI
6. **Find the request** to `/api/shared-documents/{id}` in the Network tab
7. **Right-click** on the request → **Copy** → **Copy as cURL**
8. **Paste and run** in terminal

## Method 2: Get Cookie from Browser

1. **Login** to `http://localhost:8080` in your browser
2. **Open Developer Tools** (F12) → **Application/Storage** tab → **Cookies**
3. **Find the `access_token` cookie** and copy its value
4. **Use it in curl:**

```bash
COOKIE="your_access_token_cookie_value_here"
curl -X GET "http://localhost:8080/api/shared-documents/20316373-8b33-432e-b2d9-f04101bf4907" \
  -H "Cookie: access_token=$COOKIE" \
  -H "Accept: application/json"
```

## Method 3: Using Browser Console

1. **Login** to `http://localhost:8080` in your browser
2. **Open Developer Tools** (F12) → **Console** tab
3. **Run this JavaScript:**

```javascript
fetch('/api/shared-documents/20316373-8b33-432e-b2d9-f04101bf4907', {
  credentials: 'include',
  headers: {
    'Accept': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log(data))
.catch(err => console.error(err))
```

## Method 4: Direct Browser URL

Simply navigate to the shared document in your browser:
```
http://localhost:8080/shared/document/20316373-8b33-432e-b2d9-f04101bf4907
```

The frontend will automatically call:
- `/api/shared-documents/20316373-8b33-432e-b2d9-f04101bf4907`

## API Endpoint Details

**Endpoint:** `GET /api/shared-documents/{document_id}`

**Optional Query Parameter:**
- `shared_root_id` - UUID of the root shared folder (for breadcrumb calculation)

**Example:**
```bash
# Without shared_root_id
GET /api/shared-documents/20316373-8b33-432e-b2d9-f04101bf4907

# With shared_root_id
GET /api/shared-documents/20316373-8b33-432e-b2d9-f04101bf4907?shared_root_id=some-uuid
```

**Authentication:**
- Requires authentication via cookie (`access_token`) or Bearer token
- Nginx's `auth_request` middleware validates authentication before forwarding to backend

**Response:**
- `200 OK` - Document details with breadcrumb and permissions
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Authenticated but no permission to view this document
- `404 Not Found` - Document doesn't exist or is not shared with you

## Testing with curl (After Getting Cookie)

```bash
# Get cookie from browser first, then:
curl -X GET "http://localhost:8080/api/shared-documents/20316373-8b33-432e-b2d9-f04101bf4907" \
  -H "Cookie: access_token=YOUR_COOKIE_VALUE" \
  -H "Accept: application/json" \
  -v
```

## Why Direct curl Doesn't Work

Nginx uses `auth_request /verify` which checks authentication through the auth server. The auth server validates:
- Cookies (set after browser login)
- Bearer tokens (if using API tokens)
- Remote-User headers (if configured for internal use)

Direct curl requests without proper authentication are blocked at the Nginx level, which is why you get `401 Unauthorized`.

