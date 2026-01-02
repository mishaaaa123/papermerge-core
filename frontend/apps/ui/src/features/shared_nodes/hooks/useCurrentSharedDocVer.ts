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
  console.log("[useCurrentSharedDocVer] Hook called")
  const dispatch = useAppDispatch()
  const {doc, isError} = useCurrentSharedDoc() // Get doc which already has all versions
  console.log("[useCurrentSharedDocVer] After useCurrentSharedDoc:", {
    hasDoc: !!doc,
    isError,
    docID: doc?.id
  })
  
  // Extract the last version from doc.versions (already fetched by useCurrentSharedDoc)
  const lastVersion = useMemo(() => {
    console.log("[useCurrentSharedDocVer] Extracting lastVersion:", {
      isError,
      hasDoc: !!doc,
      hasVersions: !!doc?.versions,
      versionsCount: doc?.versions?.length,
      versions: doc?.versions?.map(v => ({id: v.id, number: v.number, hasPages: !!v.pages, pagesCount: v.pages?.length}))
    })
    if (isError || !doc?.versions || doc.versions.length === 0) {
      console.log("[useCurrentSharedDocVer] No versions available")
      return undefined
    }
    // Find version with highest number (last version)
    const last = doc.versions.reduce((latest, v) => 
      v.number > latest.number ? v : latest
    )
    console.log("[useCurrentSharedDocVer] Last version found:", {
      id: last.id,
      number: last.number,
      hasPages: !!last.pages,
      pagesCount: last.pages?.length,
      is_password_protected: last.is_password_protected
    })
    return last
  }, [doc?.versions, isError])

  // Get the docVer from Redux store (it was added by documentVersSlice reducer when getSharedDocument succeeded)
  const docVerFromSlice = useAppSelector(s =>
    selectDocVerByID(s, lastVersion?.id)
  )
  
  // Debug: Log docVerFromSlice state
  useEffect(() => {
    console.log("[useCurrentSharedDocVer] docVerFromSlice state:", {
      hasLastVersion: !!lastVersion,
      lastVersionID: lastVersion?.id,
      hasDocVerFromSlice: !!docVerFromSlice,
      docVerFromSliceID: docVerFromSlice?.id
    })
  }, [lastVersion?.id, docVerFromSlice])

  // Update current docVer in UI state when we have the last version
  useEffect(() => {
    if (lastVersion?.id) {
      dispatch(currentDocVerUpdated({mode: "main", docVerID: lastVersion.id}))
    }
  }, [lastVersion?.id, dispatch])

  // Force log before useMemo to ensure we see it
  console.log("[useCurrentSharedDocVer] About to create docVer useMemo:", {
    hasDocVerFromSlice: !!docVerFromSlice,
    hasLastVersion: !!lastVersion,
    lastVersionID: lastVersion?.id,
    lastVersionType: typeof lastVersion,
    lastVersionKeys: lastVersion ? Object.keys(lastVersion) : null
  })

  const docVer: ClientDocumentVersion | undefined = useMemo(() => {
    console.log("[useCurrentSharedDocVer] 🔵 Creating docVer - useMemo running:", {
      hasDocVerFromSlice: !!docVerFromSlice,
      hasLastVersion: !!lastVersion,
      lastVersionID: lastVersion?.id,
      lastVersionType: typeof lastVersion
    })
    
    // First try to get from Redux store (preferred, has all client-side fields)
    if (docVerFromSlice) {
      console.log("[useCurrentSharedDocVer] ✅ Using docVer from Redux store:", docVerFromSlice.id)
      return docVerFromSlice
    }
    
    // If not in store yet, convert from server version
    // This happens on first load before Redux reducer processes the API response
    if (lastVersion) {
      console.log("[useCurrentSharedDocVer] ⚠️ docVerFromSlice not found, converting lastVersion to ClientDocumentVersion")
      try {
      // Handle null/undefined pages array
      const pagesArray = lastVersion.pages || []
        console.log("[useCurrentSharedDocVer] Pages array:", {
          original: lastVersion.pages,
          processed: pagesArray,
          length: pagesArray.length,
          isArray: Array.isArray(pagesArray)
        })
        
      // Convert server version to client version format
        const converted = {
        id: lastVersion.id,
        lang: lastVersion.lang,
        number: lastVersion.number,
          file_name: lastVersion.file_name || null,
        document_id: lastVersion.document_id,
        size: lastVersion.size,
          short_description: lastVersion.short_description || null,
        pages: pagesArray.map(p => ({
          id: p.id,
          number: p.number,
          angle: 0
        })),
        initial_pages: [...pagesArray]
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
        
        console.log("[useCurrentSharedDocVer] ✅ Successfully converted to ClientDocumentVersion:", {
          id: converted.id,
          pagesCount: converted.pages.length,
          is_password_protected: converted.is_password_protected
        })
        return converted
      } catch (error) {
        console.error("[useCurrentSharedDocVer] ❌ Error converting lastVersion to ClientDocumentVersion:", error)
        console.error("[useCurrentSharedDocVer] Error details:", {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          lastVersion: lastVersion
        })
        return undefined
      }
    }
    
    console.log("[useCurrentSharedDocVer] ❌ No lastVersion, returning undefined")
    return undefined
  }, [docVerFromSlice, lastVersion])

  return {
    error: undefined, // Error is already handled by useCurrentSharedDoc
    isError: isError, // Propagate error state from parent hook
    docVer: docVer
  }
}
