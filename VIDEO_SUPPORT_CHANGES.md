# Video Support Implementation Changes

This document tracks all changes made to add video file compatibility to Papermerge.

## Overview
Added support for video files (MP4, WebM, MOV, AVI) and additional image formats (GIF, WEBP, BMP) to the Papermerge document management system. Videos are stored as-is without PDF conversion, while images continue to be converted to PDF for OCR compatibility.

## Changes Made

### 1. Frontend Constants (`frontend/apps/ui/src/features/nodes/constants.ts`)
**Added:**
- Video MIME types: `MIME_MP4`, `MIME_WEBM`, `MIME_QUICKTIME`, `MIME_AVI`
- Image MIME types: `MIME_GIF`, `MIME_WEBP`, `MIME_BMP`
- Video extensions: `.mp4`, `.webm`, `.mov`, `.avi`
- Image extensions: `.gif`, `.webp`, `.bmp`

**Updated:**
- `SUPPORTED_MIME_TYPES` array to include all new types
- `SUPPORTED_EXTENSIONS` array to include all new extensions

### 2. Backend Constants (`papermerge/core/constants.py`)
**Added to `ContentType` class:**
- `VIDEO_MP4 = "video/mp4"`
- `VIDEO_WEBM = "video/webm"`
- `VIDEO_QUICKTIME = "video/quicktime"`
- `VIDEO_AVI = "video/x-msvideo"`
- `IMAGE_GIF = "image/gif"`
- `IMAGE_WEBP = "image/webp"`
- `IMAGE_BMP = "image/bmp"`

### 3. Upload Function (`papermerge/core/features/document/db/api.py`)
**Added helper functions:**
- `is_video(content_type: str) -> bool` - Checks if content type is a video
- `is_image(content_type: str) -> bool` - Checks if content type is an image (excluding PDF)

**Updated `FileType` class:**
- Added video types: `MP4`, `WEBM`, `QUICKTIME`, `AVI`
- Added image types: `GIF`, `WEBP`, `BMP`

**Modified `upload()` function:**
- Added separate handling for video files:
  - Videos are stored as-is (no PDF conversion)
  - Videos get `page_count = 1` for data model consistency
  - Single page entry created for videos
- Images continue to be converted to PDF as before
- OCR is automatically skipped for video files

### 4. Page Count Logic (`papermerge/core/lib/pagecount.py`)
**Updated `get_pagecount()` function:**
- Added recognition for new image types (gif, webp, bmp)
- Added video support: returns `1` for all video files
- Updated error message to reflect all supported file types
- Handles both MIME type and file extension detection for videos

### 5. MIME Utility (`papermerge/core/lib/mime.py`)
**Updated `is_image()` method:**
- Now includes: `image/png`, `image/jpg`, `image/jpeg`, `image/tiff`, `image/gif`, `image/webp`, `image/bmp`

**Added `is_video()` method:**
- Returns true for: `video/mp4`, `video/webm`, `video/quicktime`, `video/x-msvideo`

### 6. Upload Button (`frontend/apps/ui/src/features/nodes/components/Commander/NodesCommander/UploadButton.tsx`)
**Updated:**
- Changed `MIME_TYPES` constant to `ACCEPT_STRING` for clarity
- Added comments explaining the accept attribute format
- The `accept` attribute now properly includes both MIME types and file extensions
- File picker now shows and accepts video files

### 7. Backend Image & Dependencies (`docker/standard/Dockerfile`)
**Updated:**
- Added `ffmpeg` to the `apk add` line in the `papermerge_core` stage so the backend container has the ffmpeg binary available for future video processing (thumbnails, metadata, etc.).

### 8. Video Metadata Fields (`papermerge/core/features/document/db/orm.py`, `papermerge/core/features/document/schema.py`, Alembic)
**Added to `DocumentVersion` ORM model:**
- `video_duration: int | None` – duration in seconds
- `video_width: int | None`
- `video_height: int | None`
- `video_codec: str | None`

**Added to Pydantic `DocumentVersion` schema:**
- Same four optional fields, exposed via the API for document version responses.

**Alembic migration:**
- New migration `7f9d4e3c9a10_add_video_metadata_to_document_versions.py`:
  - Adds the four columns to the `document_versions` table.
  - Uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` for resilience if columns were created manually.

**Updated upload logic (`papermerge/core/features/document/db/api.py`):**
- When uploading a video:
  - Stores the file as-is.
  - Extracts basic metadata via `ffprobe` (duration, width, height, codec).
  - Persists the values into the new `video_*` fields on `DocumentVersion`.

### 9. Frontend Video Playback (`frontend/apps/ui/src/features/document/components/Viewer.tsx`, `.../VideoPlayer/VideoPlayer.tsx`)
**New component: `VideoPlayer`**
- Located at `frontend/apps/ui/src/features/document/components/VideoPlayer/VideoPlayer.tsx`.
- Responsibilities:
  - Fetches a download URL for the current document version via `/api/document-versions/{doc_ver_id}/download-url`.
  - Normalizes relative `/api/...` URLs to full backend URLs using `getBaseURL(true)`.
  - Renders an HTML5 `<video>` element with controls (play/pause, seek, volume, fullscreen).
  - Shows a loading state while fetching the URL and an error message if the URL cannot be obtained.

**Viewer integration:**
- `Viewer.tsx` now:
  - Detects video documents by file extension (`.mp4`, `.webm`, `.mov`, `.avi`).
  - For video documents:
    - Skips PDF preview generation (`useGeneratePreviews` result is ignored, previews treated as ready).
    - Renders the `VideoPlayer` in place of the page list.
    - Keeps the document details panel, breadcrumbs, action buttons, and dialogs unchanged.
  - For non-video documents:
    - Behavior is unchanged: PDF previews and page list are rendered as before.

## Supported File Types

### Images
- PDF (`.pdf`)
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- TIFF (`.tif`, `.tiff`)
- GIF (`.gif`) - **NEW**
- WEBP (`.webp`) - **NEW**
- BMP (`.bmp`) - **NEW**

### Videos
- MP4 (`.mp4`) - **NEW**
- WebM (`.webm`) - **NEW**
- QuickTime (`.mov`) - **NEW**
- AVI (`.avi`) - **NEW**

## Current Behavior

### Videos
- ✅ Can be uploaded via the UI
- ✅ Stored in original format (no conversion)
- ✅ Database entry created with `page_count = 1`
- ✅ OCR automatically skipped
- ✅ Basic frontend playback implemented via HTML5 `<video>` (no advanced player yet)
- ✅ Backend fields added for duration, resolution, codec
- ❌ Thumbnail generation for videos not yet implemented (PDF/image thumbnails unchanged)
- ❌ Preview generation (thumbnail strip) for videos not yet implemented

### Images
- ✅ All existing functionality preserved
- ✅ New formats (GIF, WEBP, BMP) converted to PDF
- ✅ OCR works on converted PDFs

## Technical Notes

1. **Video Storage**: Videos are stored as-is in the document version storage, maintaining original quality and format.

2. **Page Count**: Videos use `page_count = 1` for consistency with the existing data model, even though videos don't have "pages" in the traditional sense.

3. **OCR**: Videos automatically skip OCR processing since they don't contain extractable text content.

4. **Backward Compatibility**: All changes are backward compatible. Existing documents continue to work as before.

## Files Modified

1. `frontend/apps/ui/src/features/nodes/constants.ts`
2. `papermerge/core/constants.py`
3. `papermerge/core/features/document/db/api.py`
4. `papermerge/core/lib/pagecount.py`
5. `papermerge/core/lib/mime.py`
6. `frontend/apps/ui/src/features/nodes/components/Commander/NodesCommander/UploadButton.tsx`
7. `docker/standard/Dockerfile`
8. `papermerge/core/features/document/db/orm.py`
9. `papermerge/core/features/document/schema.py`
10. `papermerge/core/alembic/versions/7f9d4e3c9a10_add_video_metadata_to_document_versions.py`
11. `frontend/apps/ui/src/features/document/components/Viewer.tsx`
12. `frontend/apps/ui/src/features/document/components/VideoPlayer/VideoPlayer.tsx`

## Next Steps (TODO)

See `VIDEO_SUPPORT_TODO.md` for remaining implementation tasks.


