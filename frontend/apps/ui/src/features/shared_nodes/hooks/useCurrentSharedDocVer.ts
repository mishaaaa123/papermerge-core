import {useAppDispatch, useAppSelector} from "@/app/hooks"
import {
  selectDocVerByID
} from "@/features/document/store/documentVersSlice"
import {
  DOC_VER_PAGINATION_PAGE_BATCH_SIZE,
  DOC_VER_PAGINATION_THUMBNAIL_BATCH_SIZE
} from "@/features/document/constants"
import {
  currentDocVerUpdated
} from "@/features/ui/uiSlice"
import type {FetchBaseQueryError} from "@reduxjs/toolkit/query"
import {ClientDocumentVersion} from "@/types"
import {useMemo, useEffect} from "react"
import useCurrentSharedDoc from "./useCurrentSharedDoc"

interface SerializedError {
  name?: string
  message?: string
  stack?: string
  code?: string
}

interface ReturnState {
  isError: boolean
  error: FetchBaseQueryError | SerializedError | undefined
  docVer: ClientDocumentVersion | undefined
}

export default function useSharedCurrentDocVer(): ReturnState {
  const dispatch = useAppDispatch()
  const {doc} = useCurrentSharedDoc() // Get doc which already has all versions
  
  // Extract the last version from doc.versions (already fetched by useCurrentSharedDoc)
  const lastVersion = useMemo(() => {
    if (!doc?.versions || doc.versions.length === 0) {
      return undefined
    }
    // Find version with highest number (last version)
    return doc.versions.reduce((latest, v) => 
      v.number > latest.number ? v : latest
    )
  }, [doc?.versions])

  // Get the docVer from Redux store (it was added by documentVersSlice reducer when getSharedDocument succeeded)
  const docVerFromSlice = useAppSelector(s =>
    selectDocVerByID(s, lastVersion?.id)
  )

  // Update current docVer in UI state when we have the last version
  useEffect(() => {
    if (lastVersion?.id) {
      dispatch(currentDocVerUpdated({mode: "main", docVerID: lastVersion.id}))
    }
  }, [lastVersion?.id, dispatch])

  const docVer: ClientDocumentVersion | undefined = useMemo(() => {
    // First try to get from Redux store (preferred, has all client-side fields)
    if (docVerFromSlice) {
      return docVerFromSlice
    }
    // If not in store yet, convert from server version
    // Note: This should rarely happen as documentVersSlice adds versions when getSharedDocument succeeds
    if (lastVersion) {
      // Convert server version to client version format
      return {
        id: lastVersion.id,
        lang: lastVersion.lang,
        number: lastVersion.number,
        file_name: lastVersion.file_name,
        document_id: lastVersion.document_id,
        size: lastVersion.size,
        short_description: lastVersion.short_description,
        pages: lastVersion.pages.map(p => ({
          id: p.id,
          number: p.number,
          angle: 0
        })),
        initial_pages: [...lastVersion.pages]
          .sort((a, b) => a.number - b.number)
          .map(p => ({
            id: p.id,
            number: p.number,
            angle: 0
          })),
        pagination: {
          page_number: 1,
          per_page: DOC_VER_PAGINATION_PAGE_BATCH_SIZE
        },
        thumbnailsPagination: {
          page_number: 1,
          per_page: DOC_VER_PAGINATION_THUMBNAIL_BATCH_SIZE
        },
        is_password_protected: lastVersion.is_password_protected || false
      } as ClientDocumentVersion
    }
    return undefined
  }, [docVerFromSlice, lastVersion])

  return {
    error: undefined,
    isError: false,
    docVer: docVer
  }
}
