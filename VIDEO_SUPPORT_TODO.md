# Video Support - Remaining Tasks

This document lists the remaining tasks needed to complete full video support in Papermerge.

## High Priority Tasks

### 1. Video Thumbnail Generation (Backend)
**Status:** Not Started  
**Priority:** High  
**Files to Modify:**
- `papermerge/core/utils/image.py` - Add video thumbnail extraction
- `papermerge/core/features/nodes/router_thumbnails.py` - Handle video thumbnails
- Backend worker tasks for thumbnail generation

**Requirements:**
- Extract a frame from video (e.g., first frame or frame at 1 second)
- Use `ffmpeg` or similar tool to extract frame
- Generate thumbnail image (JPG) similar to PDF thumbnails
- Store thumbnail in same location as PDF thumbnails
- Handle video metadata (duration, resolution, codec)

**Dependencies:**
- Install `ffmpeg` in Docker container
- Add Python library for video processing (e.g., `opencv-python` or `ffmpeg-python`)

### 2. Video Playback Component (Frontend)
**Status:** Not Started  
**Priority:** High  
**Files to Create/Modify:**
- New component: `frontend/apps/ui/src/features/document/components/VideoPlayer/VideoPlayer.tsx`
- `frontend/apps/ui/src/features/document/components/PageList/PagesListContainer.tsx` - Add video detection
- `frontend/apps/ui/src/features/document/components/Viewer.tsx` - Conditional rendering
- `frontend/apps/ui/src/features/document/components/Page/Page.tsx` - Handle video pages

**Requirements:**
- HTML5 `<video>` element for playback
- Support for MP4, WebM, MOV, AVI formats
- Video controls (play, pause, volume, fullscreen)
- Responsive sizing
- Fallback for unsupported formats
- Loading states

### 3. Video Preview Generation (Frontend)
**Status:** Not Started  
**Priority:** Medium  
**Files to Modify:**
- `frontend/apps/ui/src/utils/pdf.ts` - Add video preview function
- `frontend/apps/ui/src/features/document/store/imageObjectsSlice.ts` - Skip PDF preview for videos
- `frontend/apps/ui/src/features/document/hooks/useGeneratePreviews.ts` - Handle videos

**Requirements:**
- Detect video files and skip PDF.js preview generation
- Use video thumbnail from backend or extract client-side
- Show video thumbnail in thumbnail list
- Handle video files in preview generation pipeline

### 4. Document Type Detection in Viewer
**Status:** Not Started  
**Priority:** High  
**Files to Modify:**
- `frontend/apps/ui/src/features/document/components/Viewer.tsx`
- `frontend/apps/ui/src/features/document/components/PageList/PagesListContainer.tsx`
- `frontend/apps/ui/src/features/document/components/Page/Page.tsx`

**Requirements:**
- Detect if document is a video (check MIME type or file extension)
- Conditionally render video player vs PDF viewer
- Handle mixed documents (if needed in future)

### 5. Backend Thumbnail Endpoint Updates
**Status:** Not Started  
**Priority:** Medium  
**Files to Modify:**
- `papermerge/core/features/nodes/router_thumbnails.py`
- `papermerge/core/utils/image.py`

**Requirements:**
- Check if document is a video before attempting PDF thumbnail generation
- Generate video thumbnail if video, PDF thumbnail if PDF
- Return appropriate thumbnail for both types

### 6. Shared Nodes Video Support
**Status:** Not Started  
**Priority:** Low  
**Files to Check:**
- `frontend/apps/ui/src/features/shared_nodes/components/SharedViewer/`
- Shared nodes viewer components

**Requirements:**
- Ensure shared videos can be viewed
- Video playback works in shared viewer

## Medium Priority Tasks

### 7. Video Metadata Storage
**Status:** Not Started  
**Priority:** Medium  
**Files to Modify:**
- Database schema (if needed)
- `papermerge/core/features/document/db/orm.py`
- Document version model

**Requirements:**
- Store video duration
- Store video resolution
- Store video codec information
- Display metadata in document details

### 8. Video Upload Progress
**Status:** Not Started  
**Priority:** Low  
**Files to Modify:**
- Upload components
- Progress indicators

**Requirements:**
- Show upload progress for large video files
- Better UX for video uploads

### 9. Video Format Validation
**Status:** Not Started  
**Priority:** Low  
**Files to Modify:**
- Upload validation
- Backend validation

**Requirements:**
- Validate video file integrity
- Check video codec compatibility
- Reject corrupted video files

## Implementation Order

1. **Backend Thumbnail Generation** (Task 1)
   - Required for video previews to work
   - Foundation for other features

2. **Video Playback Component** (Task 2)
   - Core functionality for viewing videos
   - Users can see uploaded videos

3. **Document Type Detection** (Task 4)
   - Required for conditional rendering
   - Enables video vs PDF switching

4. **Frontend Preview Updates** (Task 3)
   - Integrates video thumbnails
   - Completes preview pipeline

5. **Backend Thumbnail Endpoint** (Task 5)
   - Ensures API returns correct thumbnails
   - Completes backend support

6. **Remaining Tasks** (Tasks 6-9)
   - Polish and additional features
   - Can be done incrementally

## Dependencies

### Backend
- `ffmpeg` - Video processing tool
- `opencv-python` or `ffmpeg-python` - Python video libraries
- Update Dockerfile to include ffmpeg

### Frontend
- No additional dependencies needed (HTML5 video support is native)
- May want video player library for advanced features (optional)

## Testing Checklist

- [ ] Upload MP4 file
- [ ] Upload WebM file
- [ ] Upload MOV file
- [ ] Upload AVI file
- [ ] Verify video thumbnail appears
- [ ] Verify video playback works
- [ ] Verify video controls work
- [ ] Test in shared nodes viewer
- [ ] Test with large video files
- [ ] Test video metadata display
- [ ] Verify backward compatibility (PDFs still work)


