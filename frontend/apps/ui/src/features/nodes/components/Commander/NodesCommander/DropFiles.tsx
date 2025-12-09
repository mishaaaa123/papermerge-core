import {Button, Container, Group, Loader, Modal, PasswordInput, Stack, Text} from "@mantine/core"
import {useState, useMemo} from "react"

import {useAppDispatch} from "@/app/hooks"
import {apiSlice} from "@/features/api/slice"
import {uploadFile} from "@/features/files/filesSlice"

import Error from "@/components/Error"
import ScheduleOCRProcessCheckbox from "@/components/ScheduleOCRProcessCheckbox/ScheduleOCRProcessCheckbox"
import {generateThumbnail} from "@/features/nodes/thumbnailObjectsSlice"
import type {UploadFileOutput} from "@/features/nodes/types"
import {useRuntimeConfig} from "@/hooks/runtime_config"
import type {FolderType, OCRCode} from "@/types"
import {useTranslation} from "react-i18next"

type Args = {
  opened: boolean
  source_files: FileList | File[]
  target: FolderType
  onSubmit: () => void
  onCancel: () => void
}

export const DropFilesModal = ({
  source_files,
  target,
  onSubmit,
  onCancel,
  opened
}: Args) => {
  const {t} = useTranslation()
  const runtimeConfig = useRuntimeConfig()
  const dispatch = useAppDispatch()
  const [error, setError] = useState("")
  const [scheduleOCR, setScheduleOCR] = useState<boolean>(false)
  const [lang, setLang] = useState<OCRCode>("deu")
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  
  // Safety check: ensure source_files is valid
  if (!source_files || source_files.length === 0) {
    return null
  }
  
  // const source_titles = [...source_files].map(n => n.name).join(", ")
  // const target_title = target.title

  const onLangChange = (newLang: OCRCode) => {
    setLang(newLang)
  }

  const onCheckboxChange = (newValue: boolean) => {
    setScheduleOCR(newValue)
  }

  const localSubmit = async () => {
    // Validate that all passwords are filled
    const missingPasswords: string[] = []
    for (const file of source_files) {
      if (!passwords[file.name] || passwords[file.name].trim() === "") {
        missingPasswords.push(file.name)
      }
    }

    if (missingPasswords.length > 0) {
      setError(`Please set password for: ${missingPasswords.join(", ")}`)
      return
    }

    setError("")

    for (let i = 0; i < source_files.length; i++) {
      const result = await dispatch(
        uploadFile({
          file: source_files[i],
          refreshTarget: true,
          ocr: scheduleOCR,
          lang: lang,
          target,
          password: passwords[source_files[i].name]
        })
      )
      const newlyCreatedNode = result.payload as UploadFileOutput

      if (newlyCreatedNode.source?.id) {
        const newNodeID = newlyCreatedNode.source?.id
        dispatch(generateThumbnail({node_id: newNodeID, file: source_files[i]}))
      }
      dispatch(apiSlice.util.invalidateTags(["Node"]))
    }

    onSubmit()
  }

  const localCancel = () => {
    // just close the dialog
    setError("")
    onCancel()
  }

  // Handler for password changes
  const handlePasswordChange = (fileName: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.currentTarget.value
    setPasswords((prev: Record<string, string>) => ({
      ...prev,
      [fileName]: newValue
    }))
  }

  // Check if all passwords are filled (memoized to prevent re-render issues)
  const allPasswordsFilled = useMemo(() => {
    if (!source_files || source_files.length === 0) return false
    return [...source_files].every(
      file => passwords[file.name] && passwords[file.name].trim() !== ""
    )
  }, [source_files, passwords])

  return (
    <Modal title="Upload Files" opened={opened} onClose={localCancel}>
      <Container>
        <Text mb="md">
          To upload document please set password
        </Text>
        <Stack gap="md">
          {[...source_files].map((file) => (
            <PasswordInput
              key={file.name}
              label={file.name}
              placeholder="Enter password for this file"
              value={passwords[file.name] || ""}
              onChange={handlePasswordChange(file.name)}
              required
            />
          ))}
        </Stack>
        {!runtimeConfig.ocr__automatic && (
          <ScheduleOCRProcessCheckbox
            initialCheckboxValue={false}
            defaultLang={runtimeConfig.ocr__default_lang_code}
            onCheckboxChange={onCheckboxChange}
            onLangChange={onLangChange}
          />
        )}
        {error && <Error message={error} />}
        <Group gap="lg" justify="space-between" mt="md">
          <Button variant="default" onClick={localCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            leftSection={false && <Loader size={"sm"} />}
            onClick={localSubmit}
            disabled={!allPasswordsFilled}
          >
            Upload
          </Button>
        </Group>
      </Container>
    </Modal>
  )
}
