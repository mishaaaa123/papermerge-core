# API Instructions: Upload Password-Protected Document

## Prerequisites

- Server running at `http://localhost:8080`
- Authentication token
- A file to upload

## Step-by-Step Instructions

### Step 1: Get Authentication Token

```bash
curl -X POST "http://localhost:8080/api/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"1234"}'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Save the token:**
```bash
TOKEN="your_access_token_here"
```

---

### Step 2: Get Your Home Folder ID (Optional but Recommended)

You need a folder to upload the document to. Get your user info:

```bash
curl -X GET "http://localhost:8080/api/users/me" \
  -H "Authorization: Bearer $TOKEN"
```

Or list your folders:

```bash
curl -X GET "http://localhost:8080/api/nodes/" \
  -H "Authorization: Bearer $TOKEN"
```

**Note:** If you don't have a folder, you can create one first (see Step 2b).

---

### Step 2b: Create a Folder (If Needed)

```bash
curl -X POST "http://localhost:8080/api/nodes/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Documents",
    "ctype": "folder",
    "parent_id": null
  }'
```

Save the folder `id` from the response as `FOLDER_ID`.

---

### Step 3: Create a Document Node

Before uploading a file, you must create a document node:

```bash
curl -X POST "http://localhost:8080/api/nodes/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Protected Document",
    "ctype": "document",
    "parent_id": "FOLDER_ID_HERE",
    "lang": "eng",
    "ocr": false
  }'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My Protected Document",
  ...
}
```

**Save the document `id` as `DOCUMENT_ID`.**

**Note:** If you don't have a folder, you can use `"parent_id": null`, but the document may not be accessible through the UI.

---

### Step 4: Upload File with Password Protection

Now upload the actual file with password protection:

```bash
curl -X POST "http://localhost:8080/api/documents/DOCUMENT_ID_HERE/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/your/file.pdf" \
  -F "password=your_secret_password"
```

**Example with a test file:**
```bash
# Create a test file first
echo "This is a test document for password protection." > /tmp/test_document.txt

# Upload it
curl -X POST "http://localhost:8080/api/documents/DOCUMENT_ID_HERE/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_document.txt" \
  -F "password=secret123"
```

**Response (Success):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My Protected Document",
  "versions": [
    {
      "id": "version-uuid-here",
      "is_password_protected": true,
      ...
    }
  ],
  ...
}
```

---

## Complete Example Script

Here's a complete example that does everything:

```bash
#!/bin/bash

BASE_URL="http://localhost:8080"
FILE_PATH="/path/to/your/file.pdf"
PASSWORD="your_secret_password"

# Step 1: Get token
echo "Getting authentication token..."
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"1234"}')
TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')
echo "Token: ${TOKEN:0:50}..."

# Step 2: Create document node
echo "Creating document node..."
DOC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/nodes/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"$(basename $FILE_PATH)\",
    \"ctype\": \"document\",
    \"parent_id\": null,
    \"lang\": \"eng\",
    \"ocr\": false
  }")
DOC_ID=$(echo $DOC_RESPONSE | jq -r '.id')
echo "Document ID: $DOC_ID"

# Step 3: Upload with password
echo "Uploading file with password protection..."
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/documents/$DOC_ID/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$FILE_PATH" \
  -F "password=$PASSWORD")
echo "Upload response:"
echo $UPLOAD_RESPONSE | jq '.'

echo "✅ Done! Document uploaded with password protection."
```

---

## Testing the Upload

### Check if Document is Password Protected

```bash
curl -X GET "http://localhost:8080/api/documents/DOCUMENT_ID/versions" \
  -H "Authorization: Bearer $TOKEN"
```

Look for `"is_password_protected": true` in the response.

### Download the Protected Document

```bash
# First, get the document version ID
VERSION_ID="version-id-from-above-response"

# Download with password
curl -X GET "http://localhost:8080/api/document-versions/$VERSION_ID/download?password=your_secret_password" \
  -H "Authorization: Bearer $TOKEN" \
  --output downloaded_file.pdf
```

**Without password (will fail):**
```bash
curl -X GET "http://localhost:8080/api/document-versions/$VERSION_ID/download" \
  -H "Authorization: Bearer $TOKEN"
# Returns: 403 Forbidden - "Password required for this protected file"
```

---

## Using Swagger UI (Easier Alternative)

1. Open `http://localhost:8080/docs` in your browser
2. Click "Authorize" button (lock icon)
3. Enter:
   - Username: `admin`
   - Password: `1234`
4. Click "Authorize"
5. Find `POST /api/nodes/` endpoint
6. Create a document node
7. Find `POST /api/documents/{document_id}/upload` endpoint
8. Upload file with password field

---

## Troubleshooting

### Error: "Access Forbidden"
- Check that your token is valid
- Make sure you have `document.upload` scope
- Try refreshing your token

### Error: "Parent node not found"
- Make sure the `parent_id` exists
- Use `null` for `parent_id` if you don't have a folder

### Error: "Document not found"
- Make sure you created the document node first (Step 3)
- Check that the `document_id` is correct

### File Not Encrypting
- Make sure you're using `-F "password=..."` in the form data
- Check the response for `"is_password_protected": true`

---

## Notes

- **Password is per document version**, not per document
- Each version can have a different password
- Password is required for **downloading**, not viewing metadata
- The file is encrypted using Fernet (AES-256) encryption
- Password is hashed using bcrypt before storage

