import {useAppDispatch} from "@/app/hooks"
import useAreAllPreviewsAvailable from "@/features/document/hooks/useAreAllPreviewsAvailable"
import {generatePreviews} from "@/features/document/store/imageObjectsSlice"
import {getDocLastVersion} from "@/features/document/utils"
import {fileManager} from "@/features/files/fileManager"
import {ClientDocumentVersion} from "@/types"
import {ImageSize} from "@/types.d/common"
import {useEffect} from "react"

interface Args {
  docVer?: ClientDocumentVersion
  pageNumber: number
  pageSize: number
  imageSize: ImageSize
  password?: string
}

export default function useGeneratePreviews({
  docVer,
  pageSize,
  pageNumber,
  imageSize,
  password
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
        return
      }

      if (!allPreviewsAreAvailable) {
        // Don't try to load if password-protected and no password provided
        if (docVer.is_password_protected && !password) {
          console.log("Document is password-protected, password required")
          return
        }
        
        if (!fileManager.getByDocVerID(docVer.id)) {
          const {
            ok,
            data,
            error: downloadError
          } = await getDocLastVersion(docVer.document_id, password)
          if (ok && data) {
            const arrayBuffer = await data.blob.arrayBuffer()
            fileManager.store({
              buffer: arrayBuffer,
              docVerID: data.docVerID
            })
          } else {
            const errorMsg = downloadError || "Unknown download error"
            console.error("Download error:", errorMsg)
            // If it's a password error, we'll handle it in Viewer component
            // by checking docVer.is_password_protected
            return
          }
        }
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
      }
    }

    generate()
  }, [dispatch, docVer, pageSize, pageNumber, allPreviewsAreAvailable, password])

  return allPreviewsAreAvailable
}
