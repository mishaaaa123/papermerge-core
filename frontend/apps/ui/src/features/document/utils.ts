import client from "@/httpClient"
import {ClientDocumentVersion, DocVerShort} from "@/types"
import {UUID} from "@/types.d/common"
import axios from "axios"
import {
  DOC_VER_PAGINATION_PAGE_BATCH_SIZE,
  DOC_VER_PAGINATION_THUMBNAIL_BATCH_SIZE
} from "./constants"
import {DocumentVersion} from "./types"

export function clientDVFromDV(v: DocumentVersion): ClientDocumentVersion {
  let ver: ClientDocumentVersion = {
    id: v.id,
    lang: v.lang,
    number: v.number,
    document_id: v.document_id,
    size: v.size,
    short_description: v.short_description,
    file_name: v.file_name,
    pages: v.pages.map(p => {
      return {id: p.id, number: p.number, angle: 0}
    }),
    initial_pages: [...v.pages]
      .sort((a, b) => a.number - b.number)
      .map(p => {
        return {id: p.id, number: p.number, angle: 0}
      }),
    pagination: {
      page_number: 1,
      per_page: DOC_VER_PAGINATION_PAGE_BATCH_SIZE
    },
    thumbnailsPagination: {
      page_number: 1,
      per_page: DOC_VER_PAGINATION_THUMBNAIL_BATCH_SIZE
    },
    is_password_protected: v.is_password_protected
  }

  return ver
}

export async function rotateImageObjectURL(
  objectURL: string,
  angleDegrees: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const angle = ((angleDegrees % 360) + 360) % 360
      const radians = (angle * Math.PI) / 180

      let canvas = document.createElement("canvas")
      let ctx = canvas.getContext("2d")
      if (!ctx) return reject(new Error("Failed to get canvas context"))

      // Determine new canvas dimensions
      if (angle === 90 || angle === 270) {
        canvas.width = img.height
        canvas.height = img.width
      } else {
        canvas.width = img.width
        canvas.height = img.height
      }

      // Move to center and rotate
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(radians)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)

      // Export rotated image as Blob
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error("Failed to convert canvas to Blob"))
        resolve(blob)
      }, "image/png")
    }

    img.onerror = e => reject(new Error("Image failed to load"))
    img.src = objectURL
  })
}

// Return type for downloadFromUrl - throws errors instead of returning error objects
interface DownloadResult {
  docVerID: UUID
  blob: Blob
}

export async function downloadFromUrl(
  downloadUrl: string,
  docVerID: UUID,
  password?: string
): Promise<DownloadResult> {
  // Log stack trace to identify where download is being called from
  const stackTrace = new Error().stack
  console.log("[downloadFromUrl] 🔴 DOWNLOAD INITIATED:", {
    downloadUrl,
    docVerID,
    hasPassword: !!password,
    callStack: stackTrace?.split('\n').slice(0, 10).join('\n') // First 10 lines of stack
  })
  
  let url = downloadUrl

  // Add password as query parameter if provided
  if (password && url) {
    try {
      // Handle both absolute and relative URLs
      if (url.startsWith("/")) {
        // Relative URL - use base URL from client
        const baseUrl = client.defaults.baseURL || window.location.origin
        const urlObj = new URL(url, baseUrl)
        urlObj.searchParams.set("password", password)
        url = urlObj.toString()
      } else if (url.startsWith("http")) {
        // Absolute URL
        const urlObj = new URL(url)
        urlObj.searchParams.set("password", password)
        url = urlObj.toString()
      }
    } catch {
      // If URL construction fails, append password as query string manually
      const separator = url.includes("?") ? "&" : "?"
      url = `${url}${separator}password=${encodeURIComponent(password)}`
    }
  }

  try {
    // Add cache-busting to ensure fresh download every time
    const cacheBuster = `_t=${Date.now()}`
    const separator = url.includes("?") ? "&" : "?"
    const urlWithCacheBuster = `${url}${separator}${cacheBuster}`
    
    const resp = await client.get(urlWithCacheBuster, {
      responseType: "blob",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    })
    
    if (resp.status === 403) {
      // Password error - normalize to user-friendly message
      throw new Error("Wrong Password! Try Again.")
    }
    
    if (resp.status !== 200) {
      throw new Error(`Error downloading file from ${downloadUrl}: ${resp.status}`)
    }

    return {docVerID: docVerID, blob: resp.data}
  } catch (error) {
    // If it's already an Error we threw, re-throw it
    if (error instanceof Error) {
      throw error
    }
    
    // Handle axios errors
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        // Password error - normalize to user-friendly message
        throw new Error("Wrong Password! Try Again.")
      }
      
      if (error.response?.status === 429) {
        // Rate limit error - extract error message or use default
        const errorDetail = error.response.data
        let errorMessage = "Download limit exceeded. Try again tomorrow"
        
        if (errorDetail) {
          if (typeof errorDetail === "object" && errorDetail.detail) {
            if (Array.isArray(errorDetail.detail) && errorDetail.detail.length > 0) {
              errorMessage = errorDetail.detail[0]
            } else if (typeof errorDetail.detail === "string") {
              errorMessage = errorDetail.detail
            }
          } else if (typeof errorDetail === "string") {
            errorMessage = errorDetail
          }
        }
        
        throw new Error(errorMessage)
      }
      
      throw new Error(`Request failed: ${error.response?.status || "Network error"} - ${error.message}`)
    }
    
    throw new Error(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function getDocLastVersion(docID: UUID, password?: string): Promise<DownloadResult> {
  // Log stack trace to identify where download is being called from
  const stackTrace = new Error().stack
  console.log("[getDocLastVersion] 🔴 DOWNLOAD INITIATED:", {
    docID,
    hasPassword: !!password,
    callStack: stackTrace?.split('\n').slice(0, 10).join('\n') // First 10 lines of stack
  })
  
  try {
    // Add cache-busting to ensure fresh download every time
    const cacheBuster = `_t=${Date.now()}`
    let resp = await client.get(`/api/documents/${docID}/last-version/?${cacheBuster}`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    })

    if (resp.status !== 200) {
      throw new Error(`Error downloading URL for ${docID}: ${resp.status}`)
    }

    const docVer: DocVerShort = resp.data
    const downloadUrl = docVer.download_url

    if (!downloadUrl) {
      throw new Error(`No download URL found for document ${docID}`)
    }

    // Use downloadFromUrl to download the file (throws errors on failure)
    return await downloadFromUrl(downloadUrl, docVer.id, password)
  } catch (error) {
    // If it's already an Error we threw or from downloadFromUrl, re-throw it
    if (error instanceof Error) {
      throw error
    }
    
    // Handle axios errors from the first API call
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        // Password error - normalize to user-friendly message
        throw new Error("Wrong Password! Try Again.")
      }
      
      throw new Error(`Request failed: ${error.response?.status || "Network error"} - ${error.message}`)
    }
    
    throw new Error(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
