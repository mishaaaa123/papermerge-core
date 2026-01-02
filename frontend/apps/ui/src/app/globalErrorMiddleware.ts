// ============================================================================
// RTK Query Middleware for Global Error Handling
// ============================================================================

import {notifications} from "@/features/notifications/utils"
import {getErrorMessage, getErrorTitle} from "@/utils/errorHandling"
import {Action, isRejectedWithValue, Middleware} from "@reduxjs/toolkit"
import {t} from "i18next"

interface RTKQueryAction extends Action {
  meta?: {
    arg?: {
      endpointName?: string
      [key: string]: any
    }
    [key: string]: any
  }
}

/**
 * Global error handling middleware for RTK Query
 * Automatically shows notifications for all rejected mutations
 */
export const rtkQueryErrorLogger: Middleware = () => next => action => {
  // Check if this is a rejected action from RTK Query
  if (isRejectedWithValue(action)) {
    // Extract error message from payload (could be string, Error, or FetchBaseQueryError)
    let errorMessageStr = ""
    if (typeof action.payload === "string") {
      errorMessageStr = action.payload
    } else if (action.payload instanceof Error) {
      errorMessageStr = action.payload.message
    } else if (typeof action.payload === "object" && action.payload !== null) {
      // For FetchBaseQueryError or other structured errors, extract message
      const payload = action.payload as any
      if (payload.message) {
        errorMessageStr = payload.message
      } else if (payload.data?.detail) {
        errorMessageStr = typeof payload.data.detail === "string" 
          ? payload.data.detail 
          : JSON.stringify(payload.data.detail)
      }
    }

    // Skip password errors - they are handled by password modals
    const isPasswordError = 
      errorMessageStr.includes("password") || 
      errorMessageStr.includes("Password") || 
      errorMessageStr.includes("403") ||
      errorMessageStr.includes("Incorrect")
    
    if (isPasswordError) {
      // Don't show notification for password errors - handled by password modal
      return next(action)
    }

    // Skip download errors - they are handled in documentDownloadsSlice
    const isDownloadError = 
      action.type?.includes("fetchAndDownloadDocument") ||
      errorMessageStr.includes("Download limit exceeded") ||
      errorMessageStr.includes("Download failed") ||
      errorMessageStr.includes("429")
    
    if (isDownloadError) {
      // Don't show notification for download errors - handled in documentDownloadsSlice
      return next(action)
    }

    // Extract endpoint name and operation type from the action
    const endpointName = (action as RTKQueryAction).meta?.arg?.endpointName
    const operationType = extractOperationType(endpointName)

    // Create context for better error messages
    const context = operationType || "generic"

    const errorMessage = getErrorMessage(action.payload, t, context)
    const errorTitle = getErrorTitle(action.payload, t, context)

    // Show error notification
    notifications.show({
      autoClose: false,
      withBorder: true,
      color: "red",
      title: errorTitle,
      message: errorMessage
    })
  }

  return next(action)
}

/**
 * Extract operation type from endpoint name
 * e.g., "addNewUser" -> "user.create"
 */
function extractOperationType(endpointName?: string): string | undefined {
  if (!endpointName) return undefined

  // Map of common prefixes to operations
  const operationMap: Record<string, string> = {
    addNew: "create",
    add: "create",
    edit: "update",
    update: "update",
    delete: "delete",
    remove: "delete"
  }

  // Extract the operation prefix
  for (const [prefix, operation] of Object.entries(operationMap)) {
    if (endpointName.startsWith(prefix)) {
      // Extract entity name (e.g., "User" from "addNewUser")
      const entityName = endpointName.replace(prefix, "").toLowerCase()
      return `${entityName}.${operation}`
    }
  }

  return undefined
}
