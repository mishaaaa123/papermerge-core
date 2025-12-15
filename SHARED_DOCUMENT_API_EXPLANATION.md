# Shared Document API Calls - Purpose and Differences

## Overview

When rendering a shared document, the frontend makes **2 different API calls**. Here's what each one does and why:

---

## API #1: `/api/shared-documents/{id}` ✅ **CORRECT**

**Called by:** `useCurrentSharedDoc()` hook  
**Location:** `frontend/apps/ui/src/features/shared_nodes/hooks/useCurrentSharedDoc.ts`

### Purpose:
- **Fetches the complete shared document metadata**
- Returns document with **all versions**, breadcrumb, owner info, permissions, etc.
- **Checks shared access permissions** properly
- Designed specifically for shared documents

### What it returns:
```typescript
{
  id: "20316373-8b33-432e-b2d9-f04101bf4907",
  title: "Document.pdf",
  ctype: "document",
  breadcrumb: [...],  // Breadcrumb showing path from shared root
  owner_name: "admin",  // Who owns/shared this document
  perms: [...],  // Permissions for current user
  versions: [  // ALL versions of the document
    {
      id: "...",
      number: 1,
      lang: "eng",
      file_name: "...",
      pages: [...],
      ...
    },
    ...
  ],
  ...
}
```

### Why it's needed:
- Provides complete document context (breadcrumb, owner)
- Includes all versions (not just the last one)
- Properly validates shared access permissions
- Returns shared-specific metadata

### When it returns 422 (Validation Error):
FastAPI automatically returns **422 Unprocessable Entity** when:

1. **Invalid UUID format in path parameter:**
   - `document_id` is not a valid UUID format
   - Example: `/api/shared-documents/invalid-uuid` → 422
   - Error: `"Input should be a valid UUID, invalid character: expected an optional prefix of 'urn:uuid:' followed by [0-9a-fA-F-], found 'i' at 1"`

2. **Invalid UUID format in query parameter:**
   - `shared_root_id` query parameter is provided but not a valid UUID
   - Example: `/api/shared-documents/{id}?shared_root_id=invalid-uuid` → 422
   - Error: `"Input should be a valid UUID, invalid character..."`

**Note:** FastAPI automatically validates UUID types before the endpoint handler is called, so 422 errors occur at the framework level, not in the router code.

---

## API #2: `/api/documents/{id}/last-version/` ❌ **PROBLEMATIC**

**Called by:** `useCurrentSharedDocVer()` hook  
**Location:** `frontend/apps/ui/src/features/shared_nodes/hooks/useCurrentSharedDocVer.ts` (line 48)

### Purpose:
- **Fetches only the last version** of a document
- Designed for **regular (owned) documents**, not shared ones
- Returns just the document version details (pages, download URL, etc.)

### What it returns:
```typescript
{
  id: "790ebda7-216c-4adb-a09e-1792ad6efe5b",
  number: 1,
  lang: "eng",
  file_name: "Document.pdf",
  size: 7551093,
  page_count: 564,
  pages: [...],
  download_url: "/api/document-versions/.../download",
  ...
}
```

### Why it's problematic:
1. **Wrong endpoint for shared documents** - This endpoint is meant for documents you own
2. **Redundant** - The last version is already included in API #1's response
3. **Potential permission issues** - May not properly check shared access
4. **Inefficient** - Makes an extra API call when data is already available

---

## The Problem

Looking at `useCurrentSharedDocVer.ts`:

```typescript
// Line 48 - This calls the WRONG endpoint for shared documents
const { currentData } = useGetDocLastVersionQuery(currentNodeID ?? skipToken)
```

This hook should **extract the last version from the `doc` object** that's already fetched by `useCurrentSharedDoc()`, instead of making a separate API call.

### Current Flow (Inefficient):
```
1. useCurrentSharedDoc() → GET /api/shared-documents/{id}
   └─ Returns: doc with ALL versions

2. useCurrentSharedDocVer() → GET /api/documents/{id}/last-version/
   └─ Returns: Just the last version (REDUNDANT!)
```

### Should Be (Efficient):
```
1. useCurrentSharedDoc() → GET /api/shared-documents/{id}
   └─ Returns: doc with ALL versions

2. useCurrentSharedDocVer() → Extract last version from doc.versions
   └─ No API call needed!
```

---

## How They're Used

### In `SharedViewer.tsx`:
```typescript
const {doc} = useCurrentSharedDoc()        // API #1 - Gets full document
const {docVer} = useCurrentSharedDocVer()  // API #2 - Gets last version (WRONG!)
```

### What each provides:
- **`doc`** - Used for:
  - Breadcrumb display (`doc.breadcrumb`)
  - Owner information (`doc.owner_name`)
  - Document metadata (title, tags, etc.)
  - All versions list

- **`docVer`** - Used for:
  - Page rendering (pages list)
  - Thumbnail generation
  - Download functionality
  - Current version details

---

## The Fix

The `useCurrentSharedDocVer` hook should be modified to:

1. **Get the `doc` from `useCurrentSharedDoc()`** (already fetched)
2. **Extract the last version** from `doc.versions` array
3. **Remove the call to `/api/documents/{id}/last-version/`**

### Example Fix:
```typescript
export default function useSharedCurrentDocVer(): ReturnState {
  const {doc} = useCurrentSharedDoc()  // Get doc from API #1
  
  // Extract last version from doc.versions instead of making API call
  const lastVersion = useMemo(() => {
    if (!doc?.versions || doc.versions.length === 0) return undefined
    return doc.versions.reduce((latest, v) => 
      v.number > latest.number ? v : latest
    )
  }, [doc])
  
  // Convert to ClientDocumentVersion format
  const docVer = useMemo(() => {
    if (!lastVersion) return undefined
    return clientDVFromDV(lastVersion)
  }, [lastVersion])
  
  return { docVer, isError: false, error: undefined }
}
```

---

## API #3: `/api/documents/{id}/last-version/` (Get Download URL) ❌ **PROBLEMATIC**

**Called by:** `useGeneratePreviews()` hook → `getDocLastVersion()` function  
**Location:** `frontend/apps/ui/src/features/document/utils.ts` (line 95)

### Purpose:
- **Gets the download URL** for the last version of the document
- Called when generating previews/thumbnails to download the PDF file
- Returns metadata including `download_url` field

### What it returns:
```typescript
{
  id: "790ebda7-216c-4adb-a09e-1792ad6efe5b",
  number: 1,
  download_url: "/api/document-versions/.../download",
  ...
}
```

### Why it's problematic:
1. **Wrong endpoint for shared documents** - This is for owned documents
2. **Redundant** - The download URL is already in `doc.versions[].download_url` from API #1
3. **May fail permission checks** - Doesn't properly validate shared access
4. **Inefficient** - Makes an extra API call when data is already available

---

## API #4: `GET {download_url}` (Download PDF File) ⚠️ **MAY FAIL**

**Called by:** `getDocLastVersion()` function  
**Location:** `frontend/apps/ui/src/features/document/utils.ts` (line 130)

### Purpose:
- **Downloads the actual PDF file** as a blob
- Needed to generate page previews and thumbnails client-side
- The file is stored in browser's memory for preview generation

### What it does:
```typescript
// After getting download_url from API #3:
resp = await client.get(downloadUrl, {responseType: "blob"})
// Returns: PDF file as blob
```

### Why it may fail:
1. **Uses wrong download URL** - The URL from API #3 may not work for shared documents
2. **Permission issues** - The download endpoint may not check shared access properly
3. **Should use shared download URL** - Should use `download_url` from `doc.versions[]` (from API #1)

---

## Summary

| API Endpoint | Purpose | Status | Data Returned | Called By |
|-------------|---------|--------|---------------|-----------|
| `/api/shared-documents/{id}` | Get full shared document | ✅ Correct | Document + all versions + breadcrumb + owner | `useCurrentSharedDoc()` |
| `/api/documents/{id}/last-version/` | Get last version metadata | ❌ Wrong for shared | Just last version (redundant) | `useCurrentSharedDocVer()` |
| `/api/documents/{id}/last-version/` | Get download URL | ❌ Wrong endpoint | Download URL (redundant) | `useGeneratePreviews()` → `getDocLastVersion()` |
| `{download_url}` | Download PDF file | ⚠️ May fail | PDF blob | `getDocLastVersion()` |

**Total: 4 API calls** (2 redundant/problematic, 1 may fail)

### Recommendations:
1. **Fix `useCurrentSharedDocVer`:** Extract last version from `doc.versions` instead of API call
2. **Fix `useGeneratePreviews`:** Use `download_url` from `doc.versions[].download_url` instead of calling `/api/documents/{id}/last-version/`
3. **Or create shared download endpoint:** `/api/shared-document-versions/{id}/download` that properly validates shared access

