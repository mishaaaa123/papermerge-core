# How to Check Frontend Console Logs

## Browser Console Logs (Frontend JavaScript)

The `console.log` statements in the code run in your **browser**, not in Docker. To see them:

### Step 1: Open Browser Developer Tools
- **Chrome/Edge**: Press `F12` or `Ctrl+Shift+J` (Linux/Windows) / `Cmd+Option+J` (Mac)
- **Firefox**: Press `F12` or `Ctrl+Shift+K` (Linux/Windows) / `Cmd+Option+K` (Mac)

### Step 2: Go to Console Tab
Click on the "Console" tab in the developer tools

### Step 3: Filter Logs
Use the filter box and search for:
- `[SharedViewer]` - All SharedViewer component logs
- `[useGeneratePreviews]` - Preview generation logs
- `password` - Password-related logs

## Expected Logs When Opening Password-Protected Document

When you open a password-protected shared document, you should see:

```
[SharedViewer] Extracting downloadUrl from doc: {...}
[SharedViewer] Last version: {...}
[SharedViewer] Calling useGeneratePreviews with: {...}
[useGeneratePreviews] Checking previews: {...}
[useGeneratePreviews] Document is password-protected, password required
```

When password is entered:
```
[useGeneratePreviews] PDF not in cache, downloading...
[useGeneratePreviews] Using downloadUrl for shared document: ...
[useGeneratePreviews] Download result: {...}
[useGeneratePreviews] PDF stored in cache
[useGeneratePreviews] Dispatching generatePreviews...
```

If password is wrong:
```
[SharedViewer] Password error detected: Incorrect password
[useGeneratePreviews] Calling onPasswordError callback
```

When document changes:
```
[SharedViewer] Cleared cached PDF for password-protected document: <doc-id>
```

## Docker Logs (Backend API)

To check backend API logs:
```bash
docker compose logs webapp --tail=50 -f
```

This shows:
- API requests (GET, POST, etc.)
- HTTP status codes (200, 403, etc.)
- Backend errors

## Current Issue from Docker Logs

I can see multiple **403 Forbidden** errors:
```
GET /api/document-versions/539f3b3c-8519-4fbc-b9da-d29af5ab07b7/download HTTP/1.1" 403
```

This means:
- The frontend is trying to download a password-protected document
- The request is being made **without a password parameter**
- The backend is correctly rejecting it with 403

**This is expected behavior** - the password should be added to the URL as a query parameter when the user enters it in the modal.

