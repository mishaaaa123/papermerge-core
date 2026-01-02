import {useAppDispatch} from "@/app/hooks"
import useAreAllPreviewsAvailable from "@/features/document/hooks/useAreAllPreviewsAvailable"
import {generatePreviews} from "@/features/document/store/imageObjectsSlice"
import {ClientDocumentVersion} from "@/types"
import {ImageSize} from "@/types.d/common"
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
        pageCount: docVer.pages.length,
        pageNumber,
        pageSize,
        imageSize
      })

      // Don't try to load if password-protected and no password provided
      if (docVer.is_password_protected && !password) {
        console.log("[useGeneratePreviews] Document is password-protected, password required")
        return
      }
      
      // Dispatch generatePreviews - it will handle download and caching
      // useCache: false means always download fresh (skip cache check) but still cache result
      console.log("[useGeneratePreviews] Dispatching generatePreviews (useCache: false - fresh download but will cache)...")
      
      try {
        const result = await dispatch(
          generatePreviews({
            docVer,
            size: imageSize,
            pageSize,
            pageNumber,
            pageTotal: docVer.pages.length,
            password,
            downloadUrl, // Pass downloadUrl for shared documents
            useCache: false // Always download fresh for document opening
          })
        ).unwrap()
        
        // Check if thunk returned an error in payload
        if (result.error) {
          const errorMessage = result.error
          
          // Normalize 429/rate limit errors to consistent message
          if (errorMessage.includes("429") || errorMessage.includes("Request failed with status code 429")) {
            setPasswordError("Download limit exceeded. Try again tomorrow")
          } else {
            setPasswordError(errorMessage)
          }
        }
      } catch (error: any) {
        // Handle rejected thunk or other errors
        let errorMessage = "Failed to generate previews"
        
        if (error?.message) {
          errorMessage = error.message
        } else if (typeof error === "string") {
          errorMessage = error
        }
        
        // Normalize 429/rate limit errors to consistent message
        if (errorMessage.includes("429") || errorMessage.includes("Request failed with status code 429")) {
          errorMessage = "Download limit exceeded. Try again tomorrow"
        }
        
        console.error("[useGeneratePreviews] Error generating previews:", errorMessage)
        setPasswordError(errorMessage)
      }
    }

    generate()
  }, [dispatch, docVer, pageSize, pageNumber, password, downloadUrl])

  return {allPreviewsAreAvailable, passwordError}
}
