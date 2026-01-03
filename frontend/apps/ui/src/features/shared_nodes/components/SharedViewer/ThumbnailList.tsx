import {useAppDispatch, useAppSelector} from "@/app/hooks"
import {generateNextPreviews} from "@/features/document/actions"
import usePageList from "@/features/document/components/PageList/usePageList"
import Thumbnail from "@/features/document/components/Thumbnail"
import {DOC_VER_PAGINATION_THUMBNAIL_BATCH_SIZE} from "@/features/document/constants"
import useAreAllPreviewsAvailable from "@/features/document/hooks/useAreAllPreviewsAvailable"
import {selectDocVerPaginationThumnailPageNumber} from "@/features/document/store/documentVersSlice"
import {selectIsGeneratingPreviews} from "@/features/document/store/imageObjectsSlice"
import useCurrentSharedDocVer from "@/features/shared_nodes/hooks/useCurrentSharedDocVer"
import useCurrentSharedDoc from "@/features/shared_nodes/hooks/useCurrentSharedDoc"
import {useEffect, useRef, useMemo} from "react"
import {ThumbnailList} from "viewer"

interface Props {
  password?: string // Password for password-protected documents
}

export default function ThumbnailListContainer({password}: Props) {
  const {docVer} = useCurrentSharedDocVer()
  const {doc} = useCurrentSharedDoc()
  
  // Get downloadUrl from doc (same logic as SharedViewer)
  const downloadUrl = useMemo(() => {
    if (!doc?.versions || doc.versions.length === 0) {
      return undefined
    }
    const lastVersion = doc.versions.reduce((latest, v) => 
      v.number > latest.number ? v : latest
    )
    return lastVersion.download_url || undefined
  }, [doc?.versions])
  const dispatch = useAppDispatch()
  const pageNumber = useAppSelector(s =>
    selectDocVerPaginationThumnailPageNumber(s, docVer?.id)
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const {pages, loadMore} = usePageList({
    docVerID: docVer?.id,
    totalCount: docVer?.pages.length,
    size: "sm",
    cssSelector: ".thumbnail",
    containerRef: containerRef
  })
  const isGenerating = useAppSelector(s =>
    selectIsGeneratingPreviews(s, "sm", docVer?.id)
  )
  const allPreviewsAreAvailable = useAreAllPreviewsAvailable({
    docVer,
    pageSize: DOC_VER_PAGINATION_THUMBNAIL_BATCH_SIZE,
    pageNumber: pageNumber + 1,
    imageSize: "sm"
  })
  const thumbnailComponents = pages.map(p => (
    <Thumbnail key={p.id} pageID={p.id} angle={p.angle} pageNumber={p.number} />
  ))

  useEffect(() => {
    console.log("[ThumbnailList] useEffect (initial load):", {
      pagesLength: pages.length,
      isGenerating,
      docVerID: docVer?.id
    })
    
    if (pages.length == 0 && !isGenerating) {
      console.log("[ThumbnailList] 🔴 Calling generateNextPreviews for initial thumbnails (page 1)")
      dispatch(generateNextPreviews({docVer, size: "sm", pageNumber: 1, downloadUrl, password}))
    }
  }, [pages.length, docVer, isGenerating, downloadUrl, password, dispatch])

  useEffect(() => {
    console.log("[ThumbnailList] useEffect (load more):", {
      loadMore,
      isGenerating,
      allPreviewsAreAvailable,
      nextPage: pageNumber + 1,
      docVerID: docVer?.id
    })
    
    if (loadMore && !isGenerating) {
      if (!allPreviewsAreAvailable) {
        console.log("[ThumbnailList] 🔴 Calling generateNextPreviews for page:", pageNumber + 1)
        dispatch(
          generateNextPreviews({docVer, size: "sm", pageNumber: pageNumber + 1, downloadUrl, password})
        )
      } else {
        console.log("[ThumbnailList] All previews available, skipping generateNextPreviews")
      }
    }
  }, [loadMore, isGenerating, allPreviewsAreAvailable, docVer, pageNumber, downloadUrl, password, dispatch])

  return (
    <ThumbnailList
      ref={containerRef}
      thumbnailItems={thumbnailComponents}
      paginationInProgress={isGenerating}
      paginationFirstPageIsReady={pages.length > 0}
    />
  )
}
