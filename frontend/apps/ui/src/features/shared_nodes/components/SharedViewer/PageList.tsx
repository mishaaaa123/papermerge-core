import {useAppDispatch, useAppSelector} from "@/app/hooks"
import PanelContext from "@/contexts/PanelContext"
import {selectDocVerPaginationPageNumber} from "@/features/document/store/documentVersSlice"
import {selectIsGeneratingPreviews} from "@/features/document/store/imageObjectsSlice"

import Zoom from "@/components/document/Zoom"
import {generateNextPreviews} from "@/features/document/actions"
import Page from "@/features/document/components/Page"
import usePageList from "@/features/document/components/PageList/usePageList"
import {DOC_VER_PAGINATION_PAGE_BATCH_SIZE} from "@/features/document/constants"
import useAreAllPreviewsAvailable from "@/features/document/hooks/useAreAllPreviewsAvailable"
import useCurrentSharedDocVer from "@/features/shared_nodes/hooks/useCurrentSharedDocVer"
import useCurrentSharedDoc from "@/features/shared_nodes/hooks/useCurrentSharedDoc"
import {selectZoomFactor, selectDocumentCurrentPage, viewerCurrentPageUpdated} from "@/features/ui/uiSlice"
import type {PanelMode} from "@/types"
import {useContext, useEffect, useRef, useMemo} from "react"
import {PageList} from "viewer"

interface Props {
  password?: string // Password for password-protected documents
}

export default function PageListContainer({password}: Props) {
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
  const mode: PanelMode = useContext(PanelContext)
  const zoomFactor = useAppSelector(s => selectZoomFactor(s, mode))
  const pageNumber = useAppSelector(s =>
    selectDocVerPaginationPageNumber(s, docVer?.id)
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const isGenerating = useAppSelector(s =>
    selectIsGeneratingPreviews(s, "md", docVer?.id)
  )
  const {pages, loadMore, currentPageNumber: scrollBasedPageNumber} = usePageList({
    docVerID: docVer?.id,
    totalCount: docVer?.pages.length,
    cssSelector: ".page",
    containerRef: containerRef
  })
  // Use Redux state for current page (updated by navigation buttons), fallback to scroll-based detection
  const currentPageFromRedux = useAppSelector((s) => selectDocumentCurrentPage(s, mode))
  const currentPageNumber = currentPageFromRedux || scrollBasedPageNumber || 1
  
  // Initialize Redux state to page 1 when document loads
  useEffect(() => {
    if (docVer && currentPageFromRedux === undefined) {
      dispatch(viewerCurrentPageUpdated({panel: mode, pageNumber: 1}))
    }
  }, [docVer?.id, currentPageFromRedux, mode, dispatch])
  
  // Sync Redux state with scroll-based detection (so navigation buttons show correct page)
  useEffect(() => {
    if (scrollBasedPageNumber && scrollBasedPageNumber !== currentPageFromRedux) {
      dispatch(viewerCurrentPageUpdated({panel: mode, pageNumber: scrollBasedPageNumber}))
    }
  }, [scrollBasedPageNumber, currentPageFromRedux, mode, dispatch])
  const nextPageNumber = pageNumber + 1
  const allPreviewsAreAvailable = useAreAllPreviewsAvailable({
    docVer,
    pageSize: DOC_VER_PAGINATION_PAGE_BATCH_SIZE,
    pageNumber: nextPageNumber,
    imageSize: "md"
  })

  const pageComponents = pages.map(p => (
    <Page
      key={p.id}
      pageID={p.id}
      zoomFactor={zoomFactor}
      angle={p.angle}
      pageNumber={p.number}
    />
  ))

  useEffect(() => {
    if (loadMore && !isGenerating) {
      if (!allPreviewsAreAvailable) {
        dispatch(generateNextPreviews({docVer, pageNumber: nextPageNumber, downloadUrl, password}))
      }
    }
  }, [
    loadMore,
    isGenerating,
    allPreviewsAreAvailable,
    pageNumber,
    docVer,
    downloadUrl,
    password,
    dispatch
  ])

  return (
    <PageList
      ref={containerRef}
      pageItems={pageComponents}
      paginationInProgress={isGenerating}
      zoom={
        <Zoom
          pageNumber={currentPageNumber}
          pageTotal={docVer?.pages.length || 1}
        />
      }
    />
  )
}
