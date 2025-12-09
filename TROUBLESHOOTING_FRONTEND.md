# Troubleshooting: Password Fields Not Showing

## Issue
Password input fields are not appearing in the upload modal.

## Solution: Clear Browser Cache

The frontend has been rebuilt and the changes are confirmed in the bundle. The issue is likely browser caching.

### Steps to Fix:

1. **Hard Refresh the Browser:**
   - **Chrome/Edge/Firefox (Linux):** `Ctrl + Shift + R` or `Ctrl + F5`
   - **Chrome/Edge/Firefox (Mac):** `Cmd + Shift + R`
   - **Safari:** `Cmd + Option + R`

2. **Clear Browser Cache:**
   - Open Developer Tools (F12)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"

3. **Or Use Incognito/Private Mode:**
   - Open a new incognito/private window
   - Navigate to `http://localhost:8080`
   - This bypasses cache completely

4. **Verify the Changes:**
   - Go to `http://localhost:8080`
   - Click the upload button
   - You should see:
     - Text: "To upload document please set password"
     - Password input fields (one per file)
     - Upload button disabled until passwords are filled

## Verification

The changes are confirmed in the built frontend:
- ✅ Text "To upload document please set password" is in the bundle
- ✅ PasswordInput components are included
- ✅ Server is running and accessible

## If Still Not Working

1. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for any JavaScript errors

2. **Check Network Tab:**
   - Open Developer Tools (F12)
   - Go to Network tab
   - Refresh the page
   - Check if `index-BtecMZCQ.js` (or similar) is loading
   - Verify it's not loading from cache (Status should be 200, not 304)

3. **Verify File Changes:**
   ```bash
   # Check source file has the changes
   grep -n "To upload document please set password" frontend/apps/ui/src/features/nodes/components/Commander/NodesCommander/DropFiles.tsx
   
   # Check built file has the changes
   docker compose exec webapp grep "To upload document please set password" /usr/share/nginx/html/ui/assets/*.js
   ```

## Expected Behavior

When you click upload:
1. Modal opens with title "Upload Files"
2. Text shows: "To upload document please set password"
3. For each file, a password input field appears with:
   - Label: filename
   - Placeholder: "Enter password for this file"
   - Required indicator
4. Upload button is disabled (grayed out) until all passwords are filled
5. Once all passwords are entered, Upload button becomes enabled
6. Clicking Upload encrypts the files with the provided passwords

