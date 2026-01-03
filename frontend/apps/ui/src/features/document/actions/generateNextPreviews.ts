import {AppDispatch} from "@/app/types"
import {
  DOC_VER_PAGINATION_PAGE_BATCH_SIZE,
  DOC_VER_PAGINATION_THUMBNAIL_BATCH_SIZE
} from "@/features/document/constants"
import {
  docVerPaginationUpdated,
  docVerThumbnailsPaginationUpdated
} from "@/features/document/store/documentVersSlice"
import {
  generatePreviews,
  markGeneratingPreviewsBegin,
  markGeneratingPreviewsEnd
} from "@/features/document/store/imageObjectsSlice"

import {ClientDocumentVersion} from "@/types"
import {ImageSize} from "@/types.d/common"

interface Args {
  docVer?: ClientDocumentVersion
  pageNumber: number
  size?: ImageSize
  thumbnailListPageCount?: number
  password?: string
  downloadUrl?: string // For shared documents - download URL from version
}

export const generateNextPreviews =
  ({docVer, pageNumber, size = "md", thumbnailListPageCount, password, downloadUrl}: Args) =>
  async (dispatch: AppDispatch) => {
    console.log("[generateNextPreviews] 🔵 ACTION CALLED:", {
      docVerID: docVer?.id,
      pageNumber,
      size,
      hasPassword: !!password,
      hasDownloadUrl: !!downloadUrl,
      callStack: new Error().stack?.split('\n').slice(0, 8).join('\n')
    })
    
    if (!docVer) {
      return
    }

    dispatch(markGeneratingPreviewsBegin({docVerID: docVer.id, size}))

    const pageSize =
      size == "sm"
        ? DOC_VER_PAGINATION_THUMBNAIL_BATCH_SIZE
        : DOC_VER_PAGINATION_PAGE_BATCH_SIZE

    console.log("[generateNextPreviews] 🔵 Dispatching generatePreviews with useCache: true")
    await dispatch(
      generatePreviews({
        docVer,
        size,
        pageSize: pageSize,
        pageNumber,
        thumbnailListPageCount,
        pageTotal: docVer.pages.length,
        password,
        downloadUrl,
        useCache: true // Always use cache for subsequent page loads (scrolling) to avoid hitting download limits
      })
    )

    dispatch(markGeneratingPreviewsEnd({docVerID: docVer.id, size}))

    if (size == "sm") {
      dispatch(
        docVerThumbnailsPaginationUpdated({
          pageNumber: pageNumber,
          pageSize: pageSize,
          docVerID: docVer.id
        })
      )
    } else {
      dispatch(
        docVerPaginationUpdated({
          pageNumber: pageNumber,
          pageSize: pageSize,
          docVerID: docVer.id
        })
      )
    }
  }
