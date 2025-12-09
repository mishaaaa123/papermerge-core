# Password Protection Feature - Complete Change Documentation

This document tracks all changes made to implement password protection for documents in Papermerge. Use this for reference or to reverse changes if needed.

## Overview

Password protection allows users to encrypt documents with a password during upload. Each document version can have its own password, and the password is required to download the encrypted file.

## Backend Changes

### 1. Database Schema Changes

**File:** `papermerge/core/alembic/versions/a1b2c3d4e5f6_add_password_protection_to_document_versions.py`

**Migration:** Adds three new columns to `document_versions` table:
- `is_password_protected` (BOOLEAN, default FALSE)
- `password_hash` (VARCHAR(255), nullable)
- `encryption_salt` (BYTEA, nullable)

**To Reverse:**
```bash
poetry run task migrate --down-revision a1b2c3d4e5f6
```
Or manually drop columns:
```sql
ALTER TABLE document_versions DROP COLUMN encryption_salt;
ALTER TABLE document_versions DROP COLUMN password_hash;
ALTER TABLE document_versions DROP COLUMN is_password_protected;
```

---

### 2. ORM Model Changes

**File:** `papermerge/core/features/document/db/orm.py`

**Changes:**
- Added `is_password_protected: Mapped[bool] = mapped_column(default=False)` (line 84)
- Added `password_hash: Mapped[str] = mapped_column(nullable=True)` (line 85)
- Added `encryption_salt: Mapped[bytes] = mapped_column(LargeBinary, nullable=True)` (line 86)

**To Reverse:**
Remove lines 83-86 from `DocumentVersion` class.

---

### 3. Schema Changes

**File:** `papermerge/core/features/document/schema.py`

**Changes:**
- Added `is_password_protected: bool = False` to `DocumentVersion` schema class

**To Reverse:**
Remove the `is_password_protected` field from `DocumentVersion` schema.

---

### 4. Encryption Utilities (New File)

**File:** `papermerge/core/utils/encryption.py` (NEW FILE)

**Purpose:** Provides encryption/decryption and password hashing functions.

**Key Functions:**
- `encrypt_file_content(content: bytes, password: str) -> tuple[bytes, bytes]` - Encrypts file with password
- `decrypt_file_content(encrypted_content: bytes, password: str, salt: bytes) -> bytes` - Decrypts file
- `hash_password(password: str) -> str` - Hashes password with bcrypt
- `verify_password(password: str, password_hash: str) -> bool` - Verifies password
- `derive_key_from_password(password: str, salt: bytes) -> bytes` - Derives encryption key

**To Reverse:**
Delete the file:
```bash
rm papermerge/core/utils/encryption.py
```

**Dependencies Added:**
- `cryptography` - For Fernet encryption
- `bcrypt` - For password hashing

**To Remove Dependencies:**
```bash
poetry remove cryptography bcrypt
```

---

### 5. Upload API Changes

**File:** `papermerge/core/features/document/db/api.py`

**Function:** `upload()` (starts at line 944)

**Changes:**
- Added `password: str | None = None` parameter
- Added `save_file_with_encryption()` helper function (lines 958-980) that:
  - Encrypts file if password provided
  - Stores password hash and salt in database
  - Sets `is_password_protected` flag
- Modified file saving logic to use encryption helper for all file types (PDF, images, videos)

**To Reverse:**
1. Remove `password` parameter from `upload()` function signature
2. Remove `save_file_with_encryption()` helper function
3. Restore original file saving logic (remove encryption calls)
4. Remove password-related database assignments

**Key Code Sections:**
- Lines 951: Added password parameter
- Lines 958-980: Encryption helper function
- Lines 975, 974, 973: Password hash and salt storage
- Lines 1000+, 1100+, 1200+: Calls to `save_file_with_encryption()`

---

### 6. Upload Router Changes

**File:** `papermerge/core/features/document/router.py`

**Function:** `upload_file()` (starts at line 163)

**Changes:**
- Added `password: str | None = Form(None, description="Optional password to protect the file")` parameter (line 168)
- Passes password to `dbapi.upload()` call (line 226)

**To Reverse:**
1. Remove `password` parameter from function signature
2. Remove password from `dbapi.upload()` call

---

### 7. Download Router Changes

**File:** `papermerge/core/features/document/router_document_version.py`

**Function:** `download_document_version()` (starts at line 56)

**Changes:**
- Added `password: Optional[str] = Query(None, description="Password for password-protected files")` parameter (line 63)
- Added password validation logic (lines 116-129):
  - Checks if document is password-protected
  - Requires password if protected
  - Verifies password against stored hash
- Added decryption logic (lines 132-152):
  - Reads encrypted file
  - Decrypts using password and salt
  - Returns decrypted file in temporary file

**To Reverse:**
1. Remove `password` parameter
2. Remove password validation block (lines 116-129)
3. Remove decryption logic (lines 132-152)
4. Restore original file return logic

**Key Code Sections:**
- Line 63: Password query parameter
- Lines 116-129: Password validation
- Lines 132-152: File decryption
- Lines 164-168: Original unencrypted file return

---

## Frontend Changes

### 8. Upload Modal Changes

**File:** `frontend/apps/ui/src/features/nodes/components/Commander/NodesCommander/DropFiles.tsx`

**Changes:**
- **Imports:** Added `PasswordInput` and `Stack` from `@mantine/core` (line 1)
- **State:** Added `const [passwords, setPasswords] = useState<Record<string, string>>({})` (line 37)
- **Text:** Changed modal text from "Are you sure you want to upload..." to "To upload document please set password" (line 103)
- **UI:** Added password input fields for each file (lines 106-120)
- **Validation:** Added password validation in `localSubmit()` (lines 50-61)
- **Upload:** Passes password to `uploadFile()` dispatch (line 73)
- **Button State:** Upload button disabled until all passwords filled (line 138)

**To Reverse:**
1. Remove `PasswordInput` and `Stack` from imports
2. Remove password state
3. Restore original modal text
4. Remove password input fields
5. Remove password validation
6. Remove password from `uploadFile()` call
7. Remove button disabled logic

**Key Code Sections:**
- Line 1: Import changes
- Line 37: Password state
- Line 103: Modal text change
- Lines 106-120: Password inputs
- Lines 50-61: Validation
- Line 73: Password passed to upload
- Line 138: Button disabled state

---

### 9. Upload Slice Changes

**File:** `frontend/apps/ui/src/features/files/filesSlice.ts`

**Changes:**
- **Type:** Added `password?: string` to `UploadFileInput` type (line 26)
- **FormData:** Added password to FormData if provided (lines 137-139)

**To Reverse:**
1. Remove `password?: string` from `UploadFileInput` type
2. Remove password FormData append logic

**Key Code Sections:**
- Line 26: Type definition
- Lines 137-139: FormData append

---

## Dependencies Added

### Backend
```bash
poetry add cryptography bcrypt
```

**To Remove:**
```bash
poetry remove cryptography bcrypt
```

### Frontend
No new dependencies added (uses existing Mantine components).

---

## Database Migration

**Migration File:** `a1b2c3d4e5f6_add_password_protection_to_document_versions.py`

**To Apply:**
```bash
poetry run task migrate
```

**To Rollback:**
```bash
# Find the previous revision
# Then run:
alembic downgrade <previous_revision>
```

Or manually:
```sql
ALTER TABLE document_versions DROP COLUMN encryption_salt;
ALTER TABLE document_versions DROP COLUMN password_hash;
ALTER TABLE document_versions DROP COLUMN is_password_protected;
```

---

## API Changes

### New Behavior

1. **Upload Endpoint:** `POST /api/documents/{document_id}/upload`
   - Now accepts optional `password` form field
   - If password provided, file is encrypted and stored

2. **Download Endpoint:** `GET /api/document-versions/{id}/download`
   - Now accepts optional `password` query parameter
   - If document is password-protected, password is required
   - Returns 403 if password missing or incorrect

### Breaking Changes
None - all changes are backward compatible (password is optional).

---

## Testing

### Test Upload with Password
```bash
curl -X POST "http://localhost:8080/api/documents/{id}/upload" \
  -H "Authorization: Bearer {token}" \
  -F "file=@test.pdf" \
  -F "password=secret123"
```

### Test Download with Password
```bash
curl -X GET "http://localhost:8080/api/document-versions/{id}/download?password=secret123" \
  -H "Authorization: Bearer {token}" \
  --output downloaded.pdf
```

### Test Download without Password (should fail)
```bash
curl -X GET "http://localhost:8080/api/document-versions/{id}/download" \
  -H "Authorization: Bearer {token}"
# Expected: 403 Forbidden
```

---

## Security Considerations

1. **Password Storage:** Passwords are hashed with bcrypt (not stored in plain text)
2. **File Encryption:** Files encrypted with Fernet (AES-256) using PBKDF2 key derivation
3. **Unique Salts:** Each document version has its own unique encryption salt
4. **Password Transmission:** Passwords sent over HTTPS should be encrypted in transit

---

## Files Modified Summary

### Backend
1. `papermerge/core/alembic/versions/a1b2c3d4e5f6_add_password_protection_to_document_versions.py` (NEW)
2. `papermerge/core/utils/encryption.py` (NEW)
3. `papermerge/core/features/document/db/orm.py`
4. `papermerge/core/features/document/schema.py`
5. `papermerge/core/features/document/db/api.py`
6. `papermerge/core/features/document/router.py`
7. `papermerge/core/features/document/router_document_version.py`

### Frontend
1. `frontend/apps/ui/src/features/nodes/components/Commander/NodesCommander/DropFiles.tsx`
2. `frontend/apps/ui/src/features/files/filesSlice.ts`

### Configuration
1. `pyproject.toml` (dependencies added)

---

## Complete Reversal Steps

If you need to completely remove password protection:

1. **Remove Frontend Changes:**
   - Revert `DropFiles.tsx` to original state
   - Revert `filesSlice.ts` to original state

2. **Remove Backend Changes:**
   - Revert `router.py` upload endpoint
   - Revert `router_document_version.py` download endpoint
   - Revert `db/api.py` upload function
   - Revert `schema.py` DocumentVersion schema
   - Revert `orm.py` DocumentVersion model

3. **Remove New Files:**
   - Delete `papermerge/core/utils/encryption.py`
   - Delete migration file (or mark as rolled back)

4. **Rollback Database:**
   - Run migration rollback or manually drop columns

5. **Remove Dependencies:**
   ```bash
   poetry remove cryptography bcrypt
   ```

6. **Restart Services:**
   ```bash
   docker compose restart webapp
   ```

---

## Notes

- Passwords are **per document version**, not per document
- Each version can have a different password
- Password is required for **downloading**, not for viewing metadata
- Files are encrypted at rest when password is provided
- No frontend UI exists for password management (set/change/remove) - only during upload

---

## Date of Changes
December 5, 2025

