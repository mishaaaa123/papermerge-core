import {useAppDispatch, useAppSelector} from "@/app/hooks"
import {fetchAndDownloadDocument} from "@/features/document/store/documentDownloadsSlice"
import {useCurrentNode} from "@/hooks"
import {UUID} from "@/types.d/common"
import {useState, useEffect} from "react"
import {DownloadButton} from "viewer"
import useDownloadButton from "./useDownloadButton"
import PasswordPromptModal from "../PasswordPromptModal"

export default function DownloadButtonContainer() {
  const [wasOpened, setWasOpened] = useState<boolean>(false)
  const [passwordModal, setPasswordModal] = useState<{
    opened: boolean
    docVerId: string | null
    fileName: string
  }>({opened: false, docVerId: null, fileName: ""})
  const {currentNodeID} = useCurrentNode()
  const {versions, txt, isError, isLoading, i18nIsReady} = useDownloadButton({
    initiateListDownload: wasOpened,
    nodeID: currentNodeID
  })
  const dispatch = useAppDispatch()
  
  // Watch for 403 errors that indicate password is needed
  const downloadErrors = useAppSelector(state => state.documentDownloads.errorById)

  // Auto-show password prompt when 403 error occurs
  useEffect(() => {
    Object.entries(downloadErrors).forEach(([docVerId, error]) => {
      // Check if error is password-related (403 or mentions password)
      if (error && (error.includes("password") || error.includes("403") || error.includes("Password required"))) {
        // Only show if modal isn't already open for this docVer
        if (!passwordModal.opened || passwordModal.docVerId !== docVerId) {
          const version = versions?.find(v => v.id === docVerId)
          if (version) {
            setPasswordModal({
              opened: true,
              docVerId,
              fileName: version.fileName || `Version ${version.number}`
            })
          }
        }
      }
    })
  }, [downloadErrors, versions, passwordModal.opened, passwordModal.docVerId])

  const onOpen = () => {
    setWasOpened(true)
  }

  const onDownloadVersionClick = (docVerID: UUID) => {
    // Check if this version is password protected
    const version = versions?.find(v => v.id === docVerID)
    if (version?.isPasswordProtected) {
      // Show password prompt
      setPasswordModal({
        opened: true,
        docVerId: docVerID,
        fileName: version.fileName || `Version ${version.number}`
      })
    } else {
      // Download without password
      dispatch(fetchAndDownloadDocument({docVerId: docVerID}))
    }
  }

  const handlePasswordSubmit = (password: string) => {
    if (passwordModal.docVerId) {
      // Clear any previous error for this docVer before retrying
      // The error will be cleared automatically when the new request starts
      dispatch(fetchAndDownloadDocument({
        docVerId: passwordModal.docVerId,
        password
      }))
    }
    setPasswordModal({opened: false, docVerId: null, fileName: ""})
  }

  const handlePasswordModalClose = () => {
    setPasswordModal({opened: false, docVerId: null, fileName: ""})
  }

  return (
    <>
    <DownloadButton
      i18nIsReady={i18nIsReady}
      isLoading={isLoading}
      onOpen={onOpen}
      onClick={onDownloadVersionClick}
      versions={versions}
      isError={isError}
      txt={txt}
    />
      <PasswordPromptModal
        opened={passwordModal.opened}
        fileName={passwordModal.fileName}
        onClose={handlePasswordModalClose}
        onSubmit={handlePasswordSubmit}
      />
    </>
  )
}
