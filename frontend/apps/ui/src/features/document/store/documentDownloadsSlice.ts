// src/store/documentSlice.ts
import {RootState} from "@/app/types"
import axios from "@/httpClient"
import type {AxiosError} from "axios"
import {notifications} from "@mantine/notifications"
import {getBaseURL} from "@/utils"
import {createAsyncThunk, createSlice} from "@reduxjs/toolkit"

interface DocumentState {
  loadingById: Record<string, boolean>
  errorById: Record<string, string | null>
}

const initialState: DocumentState = {
  loadingById: {},
  errorById: {}
}

export const fetchAndDownloadDocument = createAsyncThunk<
  void,
  {docVerId: string; password?: string},
  {rejectValue: string; state: {documentDownloads: DocumentState}}
>(
  "document/fetchAndDownloadDocument",
  async ({docVerId, password}, {rejectWithValue, getState}) => {
    const state = getState() as RootState
    try {
      const response = await axios.get<{downloadURL: string}>(
        `/api/document-versions/${docVerId}/download-url`
      )
      const downloadURL = response.data.downloadURL
      if (!downloadURL) {
        throw new Error("Download URL not provided by server")
      }

      let url: string

      if (downloadURL.startsWith("http://") || downloadURL.startsWith("https://")) {
        // Absolute URL (cloud URL e.g. aws cloudfront URL)
        url = downloadURL
      } else if (downloadURL.startsWith("/")) {
        // Relative URL - construct absolute URL
        const baseURL = getBaseURL(true)
        if (!baseURL) {
          // Fallback to current origin if baseURL is not set
          url = `${window.location.origin}${downloadURL}`
        } else {
          url = `${baseURL}${downloadURL}`
        }
      } else {
        // Relative URL without leading slash
        const baseURL = getBaseURL(true)
        if (!baseURL) {
          url = `${window.location.origin}/api/${downloadURL}`
        } else {
          url = `${baseURL}/${downloadURL}`
        }
      }

      // Add password as query parameter if provided
      if (password) {
        try {
          const urlObj = new URL(url)
          urlObj.searchParams.set("password", password)
          url = urlObj.toString()
        } catch (error) {
          // If URL construction fails, append password as query string manually
          const separator = url.includes("?") ? "&" : "?"
          url = `${url}${separator}password=${encodeURIComponent(password)}`
        }
      }

      // Second: Fetch the actual file as blob
      const fileResponse = await axios.get(url, {
        responseType: "blob"
      })
      // Extract filename from Content-Disposition header
      let filename = extractFilenameFromHeader(
        fileResponse.headers["content-disposition"]
      )

      // Fallback to Redux state or default
      if (!filename) {
        const docVer = state.docVers.entities[docVerId]
        filename = docVer?.file_name || `document-${docVerId}.pdf`
      }

      // Get content type for proper blob creation
      const contentType =
        fileResponse.headers["content-type"] || "application/octet-stream"

      // Third: Create blob URL and trigger download
      const blob = new Blob([fileResponse.data], {type: contentType})
      const blobUrl = window.URL.createObjectURL(blob)

      const anchor = document.createElement("a")
      anchor.href = blobUrl
      anchor.setAttribute("download", filename)
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)

      window.URL.revokeObjectURL(blobUrl) // Cleanup
    } catch (err: any) {
      let errorMessage = "Download failed"
      const axiosError = err as AxiosError<{detail?: string}>

      if (axiosError?.response) {
        if (axiosError.response.status === 429) {
          errorMessage =
            axiosError.response.data?.detail ||
            "You've reached the download rate limit. Please try again in a moment."
        } else if (axiosError.response.status === 403) {
          // Handle password-related errors
          const errorDetail = axiosError.response.data
          if (typeof errorDetail === "object" && errorDetail.detail) {
            // Check if it's a structured error response
            if (Array.isArray(errorDetail.detail) && errorDetail.detail.length > 0) {
              errorMessage = errorDetail.detail[0]
            } else if (typeof errorDetail.detail === "string") {
              errorMessage = errorDetail.detail
            } else {
              errorMessage = "Password required or incorrect password"
            }
          } else if (typeof errorDetail === "string") {
            errorMessage = errorDetail
          } else {
            errorMessage = "Password required or incorrect password"
          }
        } else {
          errorMessage =
            axiosError.response.data?.detail ||
            axiosError.message ||
            "Download failed"
        }
      } else if (axiosError?.message) {
        errorMessage = axiosError.message
      }

      notifications.show({
        color: "red",
        title: "Download blocked",
        message: errorMessage
      })

      return rejectWithValue(errorMessage)
    }
  },
  {
    condition: (arg, {getState}) => {
      const {loadingById} = getState().documentDownloads
      if (loadingById[arg.docVerId]) {
        // Prevent duplicate dispatch if already downloading
        return false
      }
      return true
    }
  }
)

const documentDownloadsSlice = createSlice({
  name: "documentDownloads",
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchAndDownloadDocument.pending, (state, action) => {
        const docVerId = action.meta.arg.docVerId
        state.loadingById[docVerId] = true
        state.errorById[docVerId] = null
      })
      .addCase(fetchAndDownloadDocument.fulfilled, (state, action) => {
        const docVerId = action.meta.arg.docVerId
        state.loadingById[docVerId] = false
      })
      .addCase(fetchAndDownloadDocument.rejected, (state, action) => {
        const docVerId = action.meta.arg.docVerId
        state.loadingById[docVerId] = false
        state.errorById[docVerId] = action.payload || "Unknown error"
      })
  }
})

// Helper function to extract filename from Content-Disposition header
function extractFilenameFromHeader(
  contentDisposition: string | undefined
): string | null {
  if (!contentDisposition) return null

  // Try to match filename*=UTF-8''encoded_filename first (for unicode filenames)
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/)
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      // If decoding fails, continue to ASCII filename
    }
  }

  // Try to match filename="ascii_filename"
  const asciiMatch = contentDisposition.match(/filename="([^"]+)"/)
  if (asciiMatch) {
    return asciiMatch[1]
  }

  // Try to match filename=unquoted_filename
  const unquotedMatch = contentDisposition.match(/filename=([^;]+)/)
  if (unquotedMatch) {
    return unquotedMatch[1].trim()
  }

  return null
}

export default documentDownloadsSlice.reducer
export type {DocumentState}
