import {useAppDispatch} from "@/app/hooks"
import useAreAllPreviewsAvailable from "@/features/document/hooks/useAreAllPreviewsAvailable"
import {generatePreviews} from "@/features/document/store/imageObjectsSlice"
import {ClientDocumentVersion} from "@/types"
import {ImageSize} from "@/types.d/common"
import {useEffect, useState, useRef} from "react"

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
  
  // Track if we've already dispatched for this docVer/pageNumber/password combination
  const lastDispatchRef = useRef<{docVerID: string; pageNumber: number; password?: string} | null>(null)
  
  // Reset ref when docVer changes (different document) or password changes (user entered new password)
  useEffect(() => {
    if (docVer?.id) {
      if (lastDispatchRef.current?.docVerID !== docVer.id || lastDispatchRef.current?.password !== password) {
        lastDispatchRef.current = null
      }
    }
  }, [docVer?.id, password])

  useEffect(() => {
    const generate = async () => {
      console.log("[useGeneratePreviews] 🔵 HOOK TRIGGERED:", {
        docVerID: docVer?.id,
        pageNumber,
        pageSize,
        imageSize,
        hasPassword: !!password,
        hasDownloadUrl: !!downloadUrl,
        allPreviewsAreAvailable,
        callStack: new Error().stack?.split('\n').slice(0, 8).join('\n')
      })
      
      if (!docVer) {
        console.log("[useGeneratePreviews] No docVer, skipping")
        return
      }

      // Skip if previews are already available (avoid unnecessary downloads)
      if (allPreviewsAreAvailable) {
        console.log("[useGeneratePreviews] ✅ All previews already available, skipping dispatch (no download needed)")
        return
      }
      
      // Check if we've already dispatched for this exact docVer/pageNumber/password combination
      // This prevents duplicate dispatches but allows retries with new passwords
      if (lastDispatchRef.current?.docVerID === docVer.id && 
          lastDispatchRef.current?.pageNumber === pageNumber &&
          lastDispatchRef.current?.password === password) {
        console.log("[useGeneratePreviews] ⏭️ Already dispatched for this docVer/pageNumber/password, skipping duplicate dispatch")
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
      
      // Mark that we're dispatching for this docVer/pageNumber/password combination
      lastDispatchRef.current = {docVerID: docVer.id, pageNumber, password}
      
      // Dispatch generatePreviews - it will handle download and caching
      // useCache: false means always download fresh (skip cache check) but still cache result
      console.log("[useGeneratePreviews] 🔴 Dispatching generatePreviews (useCache: false - fresh download but will cache)...")
      
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
          
          // Normalize error messages
          if (errorMessage.includes("429") || errorMessage.includes("Request failed with status code 429")) {
            setPasswordError("Download limit exceeded. Try again tomorrow")
          } else if (errorMessage.includes("403") || errorMessage.includes("Request failed with status code 403") || errorMessage.includes("password") || errorMessage.includes("Password") || errorMessage.includes("Incorrect")) {
            setPasswordError("Wrong Password! Try Again.")
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
        
        // Normalize error messages
        if (errorMessage.includes("429") || errorMessage.includes("Request failed with status code 429")) {
          errorMessage = "Download limit exceeded. Try again tomorrow"
        } else if (errorMessage.includes("403") || errorMessage.includes("Request failed with status code 403") || errorMessage.includes("password") || errorMessage.includes("Password") || errorMessage.includes("Incorrect")) {
          errorMessage = "Wrong Password! Try Again."
        }
        
        console.error("[useGeneratePreviews] Error generating previews:", errorMessage)
        setPasswordError(errorMessage)
        // Reset ref on error to allow retry with same or new password
        lastDispatchRef.current = null
      }
    }

    generate()
  }, [dispatch, docVer, pageSize, pageNumber, password, downloadUrl, allPreviewsAreAvailable])

  return {allPreviewsAreAvailable, passwordError}
}
