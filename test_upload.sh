#!/bin/bash

# Test script to upload a file with password protection

BASE_URL="http://localhost:8080"
TEST_FILE="/tmp/test_document.txt"
PASSWORD="secret123"

echo "🔐 Testing Password-Protected File Upload"
echo "=========================================="
echo ""

# Step 1: Get authentication token
echo "Step 1: Getting authentication token..."
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"1234"}')

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:50}..."
echo ""

# Step 2: Get user info to find home folder
echo "Step 2: Getting user information..."
USER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users/me" \
  -H "Authorization: Bearer $TOKEN")

echo "User info: $USER_RESPONSE" | jq '.'
HOME_ID=$(echo $USER_RESPONSE | jq -r '.home_id // empty')

if [ -z "$HOME_ID" ] || [ "$HOME_ID" == "null" ]; then
  echo "⚠️  No home_id found, trying to get folders..."
  # Try to get any folder
  FOLDERS=$(curl -s -X GET "$BASE_URL/api/nodes/" \
    -H "Authorization: Bearer $TOKEN")
  echo "Folders response: $FOLDERS"
  # For now, let's try creating without parent_id
  HOME_ID=""
fi

echo ""

# Step 3: Create document node
echo "Step 3: Creating document node..."
if [ -n "$HOME_ID" ] && [ "$HOME_ID" != "null" ]; then
  DOC_CREATE_BODY="{\"title\":\"Test Protected Document\",\"ctype\":\"document\",\"parent_id\":\"$HOME_ID\",\"lang\":\"eng\",\"ocr\":false}"
else
  DOC_CREATE_BODY="{\"title\":\"Test Protected Document\",\"ctype\":\"document\",\"parent_id\":null,\"lang\":\"eng\",\"ocr\":false}"
fi

DOC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/nodes/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$DOC_CREATE_BODY")

DOC_ID=$(echo $DOC_RESPONSE | jq -r '.id // empty')

if [ -z "$DOC_ID" ] || [ "$DOC_ID" == "null" ]; then
  echo "❌ Failed to create document"
  echo "Response: $DOC_RESPONSE"
  exit 1
fi

echo "✅ Document created with ID: $DOC_ID"
echo ""

# Step 4: Upload file with password
echo "Step 4: Uploading file with password protection..."
UPLOAD_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$BASE_URL/api/documents/$DOC_ID/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE" \
  -F "password=$PASSWORD")

HTTP_STATUS=$(echo "$UPLOAD_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$UPLOAD_RESPONSE" | sed '/HTTP_STATUS:/d')

if [ "$HTTP_STATUS" == "200" ] || [ "$HTTP_STATUS" == "201" ]; then
  echo "✅ File uploaded successfully with password protection!"
  echo "Response: $BODY" | jq '.'
  echo ""
  echo "📋 Summary:"
  echo "  - Document ID: $DOC_ID"
  echo "  - Password: $PASSWORD"
  echo "  - File: $TEST_FILE"
  echo ""
  echo "🔍 To test download, use:"
  echo "  curl -X GET \"$BASE_URL/api/document-versions/<version_id>/download?password=$PASSWORD\" \\"
  echo "    -H \"Authorization: Bearer $TOKEN\" \\"
  echo "    --output downloaded_file.txt"
else
  echo "❌ Upload failed with status: $HTTP_STATUS"
  echo "Response: $BODY"
  exit 1
fi

