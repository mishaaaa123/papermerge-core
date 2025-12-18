import {useAppDispatch, useAppSelector} from "@/app/hooks"
import useCurrentSharedDoc from "@/features/shared_nodes/hooks/useCurrentSharedDoc"
import PasswordPromptModal from "@/features/document/components/PasswordPromptModal"
import {downloadFromUrl} from "@/features/document/utils"
import {UUID} from "@/types.d/common"
import {useState, useEffect, useMemo} from "react"
import {DownloadButton} from "viewer"
import type {DownloadDocumentVersion, I18NDownloadButtonText} from "viewer"
import {useTranslation} from "react-i18next"
import {notifications} from "@mantine/notifications"

async function downloadSharedDocument(
  downloadUrl: string,
  fileName: string,
  password?: string
): Promise<void> {
  try {
    // Use unified downloadFromUrl function (throws errors instead of returning error objects)
    const result = await downloadFromUrl(downloadUrl, "dummy-id" as UUID, password)
    
    // Extract filename from Content-Disposition header (if available)
    // Note: downloadFromUrl doesn't return headers, so we use the provided fileName
    const filename = fileName

    // Get content type for proper blob creation
    const contentType = "application/pdf" // Default to PDF for document downloads

    // Create blob URL and trigger download
    const blob = new Blob([result.blob], {type: contentType})
    const blobUrl = window.URL.createObjectURL(blob)

    const anchor = document.createElement("a")
    anchor.href = blobUrl
    anchor.setAttribute("download", filename)
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.URL.revokeObjectURL(blobUrl)

    notifications.show({
      title: "Download",
      message: `Downloading ${filename}`,
      color: "green"
    })
  } catch (error) {
    // Error already thrown by downloadFromUrl with proper message
    // Don't show notification here - let the component handle it via modal
    // Only show notification for non-password errors
    const errorMessage = error instanceof Error ? error.message : "Download failed"
    const isPasswordError = 
      errorMessage.includes("password") || 
      errorMessage.includes("Password") || 
      errorMessage.includes("403") ||
      errorMessage.includes("Incorrect")
    
    if (!isPasswordError) {
      // Only show notification for non-password errors
      notifications.show({
        title: "Download Error",
        message: errorMessage,
        color: "red"
      })
    }
    throw error
  }
}

export default function DownloadButtonContainer() {
  const [wasOpened, setWasOpened] = useState<boolean>(false)
  const [passwordModal, setPasswordModal] = useState<{
    opened: boolean
    docVerId: string | null
    fileName: string
    downloadUrl: string | null
  }>({opened: false, docVerId: null, fileName: "", downloadUrl: null})
  const [passwordError, setPasswordError] = useState<string>("")
  const {doc} = useCurrentSharedDoc()
  const {t, i18n} = useTranslation()
  const [txt, setTxt] = useState<I18NDownloadButtonText>()

  // Convert doc.versions to DownloadDocumentVersion format
  const versions = useMemo<Array<DownloadDocumentVersion> | undefined>(() => {
    if (!doc?.versions || doc.versions.length === 0) {
      return undefined
    }
    return doc.versions.map(v => ({
      id: v.id,
      number: v.number,
      shortDescription: v.short_description || "",
      isPasswordProtected: v.is_password_protected || false,
      fileName: v.file_name || ""
    }))
  }, [doc?.versions])

  // Setup i18n text
  useEffect(() => {
    if (i18n.isInitialized) {
      setTxt({
        downloadInProgressTooltip:
          t("downloadButton.downloadInProgressTooltip") ||
          "Download in progress...",
        downloadTooltip:
          t("downloadButton.downloadTooltip") || "Download document",
        loadingTooltip: t("downloadButton.loadingTooltip") || "Loading...",
        error: t("downloadButton.error") || "Error: Oops, it didn't work",
        emptyVersionsArrayError:
          t("downloadButton.emptyVersionsArrayError") ||
          "Error: empty version list",
        versionLabel: t("downloadButton.versionLabel") || "Version"
      })
    } else {
      setTxt(undefined)
    }
  }, [i18n.isInitialized, t])

  const onOpen = () => {
    setWasOpened(true)
  }

  const onDownloadVersionClick = (docVerID: UUID) => {
    // Find the version in doc.versions
    const version = doc?.versions?.find(v => v.id === docVerID)
    if (!version) {
      notifications.show({
        title: "Error",
        message: "Version not found",
        color: "red"
      })
      return
    }

    // Check if this version is password protected
    if (version.is_password_protected) {
      // Show password prompt
      setPasswordModal({
        opened: true,
        docVerId: docVerID,
        fileName: version.file_name || `Version ${version.number}`,
        downloadUrl: version.download_url || null
      })
      setPasswordError("")
    } else {
      // Download without password
      if (version.download_url) {
        downloadSharedDocument(version.download_url, version.file_name || `document-${docVerID}.pdf`)
          .catch(() => {
            // Error already handled in downloadSharedDocument
          })
      } else {
        notifications.show({
          title: "Error",
          message: "Download URL not available",
          color: "red"
        })
      }
    }
  }

  const handlePasswordSubmit = async (password: string) => {
    if (passwordModal.docVerId && passwordModal.downloadUrl) {
      setPasswordError("")
      try {
        await downloadSharedDocument(
          passwordModal.downloadUrl,
          passwordModal.fileName,
          password
        )
        // Success - close modal
        setPasswordModal({opened: false, docVerId: null, fileName: "", downloadUrl: null})
      } catch (error) {
        // Check if it's a password error
        const errorMessage = error instanceof Error ? error.message : "Download failed"
        if (errorMessage.includes("password") || errorMessage.includes("Password") || errorMessage.includes("403")) {
          setPasswordError(errorMessage)
          // Keep modal open so user can try again
        } else {
          // Other error - close modal
          setPasswordModal({opened: false, docVerId: null, fileName: "", downloadUrl: null})
        }
      }
    }
  }

  const handlePasswordModalClose = () => {
    setPasswordModal({opened: false, docVerId: null, fileName: "", downloadUrl: null})
    setPasswordError("")
  }

  return (
    <>
      <DownloadButton
        i18nIsReady={i18n.isInitialized}
        isLoading={false}
        onOpen={onOpen}
        onClick={onDownloadVersionClick}
        versions={versions}
        isError={false}
        txt={txt}
      />
      <PasswordPromptModal
        opened={passwordModal.opened}
        fileName={passwordModal.fileName}
        onClose={handlePasswordModalClose}
        onSubmit={handlePasswordSubmit}
        error={passwordError || undefined}
        onErrorClear={() => setPasswordError("")}
      />
    </>
  )
}
