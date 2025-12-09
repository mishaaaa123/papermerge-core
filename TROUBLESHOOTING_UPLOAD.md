# Troubleshooting: curl File Upload Error

## Error: `curl: (26) Failed to open/read local data from file/application`

This error means curl cannot find or read the file you're trying to upload.

## Common Causes & Solutions

### 1. File Path is Incorrect

**Problem:** The file doesn't exist at the specified path.

**Solution:** Check the file exists:
```bash
# Check if file exists
ls -la /path/to/your/file.pdf

# Use absolute path
curl -X POST "http://localhost:8080/api/documents/$DOC_ID/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/full/absolute/path/to/file.pdf" \
  -F "password=secret123"
```

### 2. File Path Has Spaces

**Problem:** File paths with spaces need to be quoted.

**Solution:** Quote the file path:
```bash
# Wrong:
-F "file=@/path/to/my file.pdf"

# Correct:
-F "file=@/path/to/my file.pdf"  # Already quoted, but make sure the path is correct
# Or use the full path in quotes:
-F "file=@\"/home/user/my file.pdf\""
```

### 3. Using Relative Path

**Problem:** Relative paths might not resolve correctly.

**Solution:** Use absolute path or check current directory:
```bash
# Check where you are
pwd

# Use absolute path
-F "file=@$(pwd)/filename.pdf"

# Or navigate to file directory first
cd /path/to/file/directory
curl ... -F "file=@filename.pdf"
```

### 4. File Permissions

**Problem:** File might not be readable.

**Solution:** Check and fix permissions:
```bash
# Check permissions
ls -la /path/to/file.pdf

# Make readable (if needed)
chmod 644 /path/to/file.pdf
```

### 5. Special Characters in Path

**Problem:** Special characters need escaping.

**Solution:** Escape special characters or use quotes:
```bash
# If path has special chars, escape them or use quotes
-F "file=@/path/with\ spaces/file.pdf"
```

## Step-by-Step Debugging

### Step 1: Create a Test File

```bash
# Create a simple test file
echo "This is a test document" > /tmp/test_upload.txt

# Verify it exists
ls -la /tmp/test_upload.txt
cat /tmp/test_upload.txt
```

### Step 2: Test with Simple Path

```bash
# Use the test file with absolute path
TOKEN="your_token_here"
DOC_ID="your_document_id_here"

curl -X POST "http://localhost:8080/api/documents/$DOC_ID/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_upload.txt" \
  -F "password=test123"
```

### Step 3: Verify File Path in Command

```bash
# Check what curl sees
echo "File path: /tmp/test_upload.txt"
ls -la /tmp/test_upload.txt

# Test file reading
cat /tmp/test_upload.txt
```

## Complete Working Example

```bash
#!/bin/bash

# Step 1: Create test file
TEST_FILE="/tmp/test_upload_$(date +%s).txt"
echo "This is a test document for password protection" > "$TEST_FILE"
echo "Created test file: $TEST_FILE"
ls -la "$TEST_FILE"

# Step 2: Get token
TOKEN=$(curl -s -X POST "http://localhost:8080/api/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"1234"}' | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Failed to get token"
  exit 1
fi
echo "✅ Got token"

# Step 3: Create document
DOC_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/nodes/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Protected Document",
    "ctype": "document",
    "parent_id": null,
    "lang": "eng",
    "ocr": false
  }')

DOC_ID=$(echo "$DOC_RESPONSE" | jq -r '.id')

if [ -z "$DOC_ID" ] || [ "$DOC_ID" == "null" ]; then
  echo "❌ Failed to create document: $DOC_RESPONSE"
  exit 1
fi
echo "✅ Created document: $DOC_ID"

# Step 4: Upload file (using absolute path)
echo "Uploading file: $TEST_FILE"
UPLOAD_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "http://localhost:8080/api/documents/$DOC_ID/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE" \
  -F "password=secret123")

HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$UPLOAD_RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "201" ]; then
  echo "✅ Upload successful!"
  echo "$BODY" | jq '.versions[0].is_password_protected'
else
  echo "❌ Upload failed: HTTP $HTTP_CODE"
  echo "$BODY"
fi
```

## Alternative: Using a File You Already Have

If you have a file you want to upload:

```bash
# 1. Find your file
find ~ -name "*.pdf" -type f 2>/dev/null | head -5

# 2. Copy it to a simple path
cp "/complex/path/to/your/file.pdf" /tmp/upload_file.pdf

# 3. Upload from simple path
curl -X POST "http://localhost:8080/api/documents/$DOC_ID/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/upload_file.pdf" \
  -F "password=secret123"
```

## Quick Fix Checklist

- [ ] File exists? (`ls -la /path/to/file`)
- [ ] Using absolute path?
- [ ] File is readable? (`cat /path/to/file` works)
- [ ] No special characters in path?
- [ ] Using `@` symbol before file path? (`-F "file=@/path"`)
- [ ] File path is quoted if it has spaces?

## Still Having Issues?

Share:
1. The exact curl command you're using
2. The output of: `ls -la /path/to/your/file`
3. The full error message

