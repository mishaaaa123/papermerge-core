import {useAppDispatch} from "@/app/hooks"
import useAreAllPreviewsAvailable from "@/features/document/hooks/useAreAllPreviewsAvailable"
import {generatePreviews} from "@/features/document/store/imageObjectsSlice"
import {getDocLastVersion, downloadFromUrl} from "@/features/document/utils"
import {fileManager} from "@/features/files/fileManager"
import {ClientDocumentVersion} from "@/types"
import {ImageSize} from "@/types.d/common"
import {UUID} from "@/types.d/common"
import {useEffect, useState} from "react"

interface Args {
  docVer?: ClientDocumentVersion
  pageNumber: number
  pageSize: number
  imageSize: ImageSize
  password?: string
  downloadUrl?: string // For shared documents - download URL from version
}

interface ReturnType {
  allPreviewsAreAvailable: boolean
  passwordError: string | null
}

export default function useGeneratePreviews({
  docVer,
  pageSize,
  pageNumber,
  imageSize,
  password,
  downloadUrl
}: Args): ReturnType {
  const dispatch = useAppDispatch()
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const allPreviewsAreAvailable = useAreAllPreviewsAvailable({
    docVer,
    pageSize,
    pageNumber,
    imageSize
  })

  useEffect(() => {
    const generate = async () => {
      if (!docVer) {
        console.log("[useGeneratePreviews] No docVer, skipping")
        return
      }

      // Clear previous errors when starting new download
      setPasswordError(null)

      console.log("[useGeneratePreviews] Checking previews:", {
        docVerID: docVer.id,
        documentID: docVer.document_id,
        allPreviewsAreAvailable,
        hasPDFInCache: !!fileManager.getByDocVerID(docVer.id),
        pageCount: docVer.pages.length,
        pageNumber,
        pageSize,
        imageSize
      })

      if (!allPreviewsAreAvailable) {
        // Don't try to load if password-protected and no password provided
        if (docVer.is_password_protected && !password) {
          console.log("[useGeneratePreviews] Document is password-protected, password required")
          return
        }
        
        if (!fileManager.getByDocVerID(docVer.id)) {
          console.log("[useGeneratePreviews] PDF not in cache, downloading...")
          
          try {
            let result: {docVerID: UUID; blob: Blob}
            
            // For shared documents, use the downloadUrl directly
            if (downloadUrl) {
              console.log("[useGeneratePreviews] Using downloadUrl for shared document:", downloadUrl)
              result = await downloadFromUrl(downloadUrl, docVer.id, password)
            } else {
              // For regular documents, use the standard endpoint
              // getDocLastVersion now throws errors (same pattern as downloadFromUrl)
              console.log("[useGeneratePreviews] Using getDocLastVersion for regular document:", docVer.document_id)
              result = await getDocLastVersion(docVer.document_id, password)
            }
            
            console.log("[useGeneratePreviews] Download result:", {
              hasData: !!result,
              docVerID: result.docVerID
            })
            
            // Store PDF in cache
            const arrayBuffer = await result.blob.arrayBuffer()
            fileManager.store({
              buffer: arrayBuffer,
              docVerID: result.docVerID
            })
            console.log("[useGeneratePreviews] PDF stored in cache")
          } catch (error) {
            // Catch error and store message (same pattern as download)
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            console.error("[useGeneratePreviews] Download error:", errorMessage)
            setPasswordError(errorMessage)
            // Don't try to generate previews on error
            return
          }
        } else {
          console.log("[useGeneratePreviews] PDF already in cache")
        }
        
        console.log("[useGeneratePreviews] Dispatching generatePreviews...")
        dispatch(
          generatePreviews({
            docVer,
            size: imageSize,
            pageSize,
            pageNumber,
            pageTotal: docVer.pages.length,
            password
          })
        )
      } else {
        console.log("[useGeneratePreviews] All previews already available")
      }
    }

    generate()
  }, [dispatch, docVer, pageSize, pageNumber, allPreviewsAreAvailable, password, downloadUrl])

  return {allPreviewsAreAvailable, passwordError}
}
