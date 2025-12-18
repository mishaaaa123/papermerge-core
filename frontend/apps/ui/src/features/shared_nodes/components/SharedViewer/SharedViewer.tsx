import {useAppDispatch, useAppSelector} from "@/app/hooks"

import {Flex, Group, Loader} from "@mantine/core"
import {useContext, useRef, useMemo, useState, useEffect} from "react"
import {useNavigate} from "react-router-dom"

import {
  currentDocVerUpdated,
  currentSharedNodeRootChanged,
  selectCurrentSharedNodeID,
  selectLastPageSize
} from "@/features/ui/uiSlice"

import SharedBreadcrumbs from "@/components/SharedBreadcrumb"
import PanelContext from "@/contexts/PanelContext"

import {store} from "@/app/store"
import {SHARED_FOLDER_ROOT_ID} from "@/cconstants"
import DocumentDetails from "@/components/document/DocumentDetails/DocumentDetails"
import DocumentDetailsToggle from "@/components/document/DocumentDetailsToggle"
import ThumbnailsToggle from "@/components/document/ThumbnailsToggle"
import classes from "@/components/document/Viewer.module.css"
import {DOC_VER_PAGINATION_PAGE_BATCH_SIZE} from "@/features/document/constants"
import useGeneratePreviews from "@/features/document/hooks/useGeneratePreviews"
import PasswordPromptModal from "@/features/document/components/PasswordPromptModal"
import {fileManager} from "@/features/files/fileManager"
import PageList from "./PageList"
import ThumbnailList from "./ThumbnailList"

import {RootState} from "@/app/types"
import {
  useCurrentSharedDoc,
  useCurrentSharedDocVer
} from "@/features/shared_nodes/hooks"
import type {NType, PanelMode} from "@/types"
import ActionButtons from "./ActionButtons"

export default function SharedViewer() {
  const {doc} = useCurrentSharedDoc()
  const {docVer} = useCurrentSharedDocVer()

  const ref = useRef<HTMLDivElement>(null)
  const mode: PanelMode = useContext(PanelContext)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  // Password state for viewing password-protected documents
  // password: The password entered by the user (misha) - null if not entered yet
  const [password, setPassword] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string>("")
  
  // Document password protection status (from backend - set by admin)
  const isDocumentPasswordProtected = docVer?.is_password_protected || false
  
  // Whether the user has entered a password (frontend state)
  const hasUserEnteredPassword = !!password
  
  // Check if document is password-protected AND user hasn't entered password yet
  const needsPassword = isDocumentPasswordProtected && !hasUserEnteredPassword
  
  // Debug logging
  useEffect(() => {
    console.log("[SharedViewer] Password protection check:", {
      hasDocVer: !!docVer,
      docVerID: docVer?.id,
      isDocumentPasswordProtected: isDocumentPasswordProtected, // Document requires password (set by admin)
      hasUserEnteredPassword: hasUserEnteredPassword, // User (misha) has entered password
      needsPassword: needsPassword // Document is protected AND user hasn't entered password
    })
  }, [docVer?.id, isDocumentPasswordProtected, hasUserEnteredPassword, needsPassword])
  
  // Track the last document ID to detect document changes
  const [lastDocVerId, setLastDocVerId] = useState<string | null>(null)
  
  // Clear password and cache when document changes
  useEffect(() => {
    if (docVer?.id && lastDocVerId !== docVer.id) {
      // Clear password state when document changes
      setPassword(null)
      setPasswordError("")
      
      // Clear cached PDF for password-protected documents to force re-authentication
      if (isDocumentPasswordProtected) {
        const deletedCount = fileManager.deleteByDocVerID(docVer.id)
        if (deletedCount > 0) {
          console.log("[SharedViewer] Cleared cached PDF for password-protected document:", docVer.id)
        }
      }
      
      setLastDocVerId(docVer.id)
    }
  }, [docVer?.id, docVer?.is_password_protected, lastDocVerId, isDocumentPasswordProtected])
  

  // Get download_url from the last version for shared documents
  const downloadUrl = useMemo(() => {
    console.log("[SharedViewer] Extracting downloadUrl from doc:", {
      hasDoc: !!doc,
      hasVersions: !!doc?.versions,
      versionsCount: doc?.versions?.length,
      versions: doc?.versions?.map(v => ({id: v.id, number: v.number, download_url: v.download_url}))
    })
    if (!doc?.versions || doc.versions.length === 0) {
      console.log("[SharedViewer] No versions found, returning undefined")
      return undefined
    }
    const lastVersion = doc.versions.reduce((latest, v) => 
      v.number > latest.number ? v : latest
    )
    console.log("[SharedViewer] Last version:", {
      id: lastVersion.id,
      number: lastVersion.number,
      download_url: lastVersion.download_url
    })
    return lastVersion.download_url || undefined
  }, [doc?.versions])

  console.log("[SharedViewer] Calling useGeneratePreviews with:", {
    hasDocVer: !!docVer,
    docVerID: docVer?.id,
    downloadUrl: downloadUrl
  })

  /* generate first batch of previews: for pages and for their thumbnails */
  const allPreviewsAreAvailable = useGeneratePreviews({
    docVer: docVer,
    pageNumber: 1,
    pageSize: DOC_VER_PAGINATION_PAGE_BATCH_SIZE,
    imageSize: "md",
    downloadUrl: downloadUrl, // Pass download_url for shared documents
    password: password || undefined, // Pass password for password-protected documents
    onPasswordError: (error: string) => {
      // Callback when password error occurs (wrong password)
      console.log("[SharedViewer] Password error detected:", error)
      setPasswordError(error)
      setPassword(null) // Clear password so user can try again - this will make needsPassword=true, showing modal again
    }
  })

  const lastPageSize = useAppSelector(s => selectLastPageSize(s, mode))
  const currentNodeID = useAppSelector(selectCurrentSharedNodeID)

  const onClick = (node: NType) => {
    if (node.ctype == "folder") {
      if (node.id == SHARED_FOLDER_ROOT_ID) {
        dispatch(currentSharedNodeRootChanged(undefined))
        navigate(`/shared`)
        return
      }
    }

    if (mode == "main" && node.ctype == "folder") {
      const state = store.getState() as RootState
      const sharedNode = state.sharedNodes.entities[node.id]
      if (sharedNode.is_shared_root) {
        dispatch(currentSharedNodeRootChanged(node.id))
      }
      dispatch(currentDocVerUpdated({mode: mode, docVerID: undefined}))
      navigate(`/shared/folder/${node.id}?page_size=${lastPageSize}`)
    }
  }
  /*
  useEffect(() => {
    if (doc) {
      const maxVerNum = Math.max(...doc.versions.map(v => v.number))
      const docVer = doc.versions.find(v => v.number == maxVerNum)
      if (docVer) {
        dispatch(currentDocVerUpdated({mode: mode, docVerID: docVer.id}))
      }
    }
  }, [isSuccess, doc])
  console.log(`shared viewer ${doc}`)
  */
  const handlePasswordSubmit = (enteredPassword: string) => {
    // Clear any previous errors when submitting new password
    setPasswordError("")
    setPassword(enteredPassword)
    // When password is set, needsPassword becomes false, so modal will close automatically
  }

  const handlePasswordModalClose = () => {
    // Don't allow closing without password for protected documents
    if (needsPassword) {
      setPasswordError("Password is required to view this document")
      // Modal stays open because needsPassword is still true
      return
    }
    // If needsPassword is false, modal won't be rendered anyway
  }

  if (!doc) {
    return <Loader />
  }

  if (!docVer) {
    return <Loader />
  }

  // Show password modal if document is password-protected
  if (needsPassword) {
    return (
      <div style={{display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", padding: "20px"}}>
        <PasswordPromptModal
          opened={true}  // Force open when needsPassword is true
          fileName={docVer?.file_name || "document"}
          onClose={handlePasswordModalClose}
          onSubmit={handlePasswordSubmit}
          error={passwordError || undefined}
        />
        {passwordError && (
          <div style={{color: "red", marginTop: "10px", textAlign: "center"}}>{passwordError}</div>
        )}
      </div>
    )
  }

  if (!allPreviewsAreAvailable) {
    return <Loader />
  }
  return (
    <div>
      <ActionButtons />
      <Group justify="space-between">
        <SharedBreadcrumbs breadcrumb={doc?.breadcrumb} onClick={onClick} />
        <DocumentDetailsToggle />
      </Group>
      <Flex ref={ref} className={classes.inner}>
        <ThumbnailList />
        <ThumbnailsToggle />
        <PageList />
        <DocumentDetails
          doc={doc}
          docVer={docVer}
          docID={currentNodeID}
          isLoading={false}
        />
      </Flex>
    </div>
  )
}
