import {useAppDispatch} from "@/app/hooks"
import useAreAllPreviewsAvailable from "@/features/document/hooks/useAreAllPreviewsAvailable"
import {generatePreviews} from "@/features/document/store/imageObjectsSlice"
import {getDocLastVersion, downloadFromUrl} from "@/features/document/utils"
import {fileManager} from "@/features/files/fileManager"
import {ClientDocumentVersion} from "@/types"
import {ImageSize} from "@/types.d/common"
import {UUID} from "@/types.d/common"
import {useEffect} from "react"

interface Args {
  docVer?: ClientDocumentVersion
  pageNumber: number
  pageSize: number
  imageSize: ImageSize
  password?: string
  downloadUrl?: string // For shared documents - download URL from version
  onPasswordError?: (error: string) => void // Callback for password errors
}

export default function useGeneratePreviews({
  docVer,
  pageSize,
  pageNumber,
  imageSize,
  password,
  downloadUrl,
  onPasswordError
}: Args): boolean {
  const dispatch = useAppDispatch()
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
          
          let result: {ok: boolean; data?: {docVerID: UUID; blob: Blob}; error?: string}
          
          // For shared documents, use the downloadUrl directly
          if (downloadUrl) {
            console.log("[useGeneratePreviews] Using downloadUrl for shared document:", downloadUrl)
            result = await downloadFromUrl(downloadUrl, docVer.id, password)
          } else {
            // For regular documents, use the standard endpoint
            result = await getDocLastVersion(docVer.document_id, password)
          }
          
          console.log("[useGeneratePreviews] Download result:", {
            ok: result.ok,
            hasData: !!result.data,
            error: result.error,
            docVerID: result.data?.docVerID
          })
          
          if (result.ok && result.data) {
            const arrayBuffer = await result.data.blob.arrayBuffer()
            fileManager.store({
              buffer: arrayBuffer,
              docVerID: result.data.docVerID
            })
            console.log("[useGeneratePreviews] PDF stored in cache")
          } else {
            const errorMsg = result.error || "Unknown download error"
            console.error("[useGeneratePreviews] Download error:", errorMsg)
            
            // If it's a password error, notify the parent component
            if (result.isPasswordError && onPasswordError) {
              console.log("[useGeneratePreviews] Calling onPasswordError callback")
              onPasswordError(errorMsg)
            }
            
            // For all errors, just return (don't try to generate previews)
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
  }, [dispatch, docVer, pageSize, pageNumber, allPreviewsAreAvailable, password, downloadUrl, onPasswordError])

  return allPreviewsAreAvailable
}
