import {useAppSelector} from "@/app/hooks"
import {
  ActionIcon,
  Group,
  Skeleton,
  Stack,
  TagsInput,
  Text,
  TextInput
} from "@mantine/core"
import {useDisclosure} from "@mantine/hooks"
import {useContext} from "react"
import {useTranslation} from "react-i18next"

import PanelContext from "@/contexts/PanelContext"
import {useGetDocumentQuery} from "@/features/document/store/apiSlice"
import {selectDocumentVersionOCRLang} from "@/features/document/store/documentVersSlice"
import {skipToken} from "@reduxjs/toolkit/query"
import {IconEdit} from "@tabler/icons-react"
import classes from "./DocumentDetails.module.css"

import {OWNER_ME} from "@/cconstants"
import CopyButton from "@/components/CopyButton"
import {EditNodeTagsModal} from "@/components/EditNodeTags"
import type {DocumentType} from "@/features/document/types"
import {
  selectCurrentNodeID,
  selectDocumentDetailsPanelOpen
} from "@/features/ui/uiSlice"
import type {ClientDocumentVersion, PanelMode} from "@/types"
import DocumentDetailsToggle from "../DocumentDetailsToggle"
import CustomFields from "./CustomFields"

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return ""
  }
  const seconds = Math.floor(totalSeconds)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  const parts = []
  if (h > 0) {
    parts.push(h.toString().padStart(2, "0"))
  }
  parts.push(m.toString().padStart(2, "0"))
  parts.push(s.toString().padStart(2, "0"))
  return parts.join(":")
}

interface Args {
  doc?: DocumentType
  docID?: string
  docVer?: ClientDocumentVersion
  isLoading: boolean
}

export default function DocumentDetails({doc, docVer, docID, isLoading}: Args) {
  const {t} = useTranslation()

  const mode: PanelMode = useContext(PanelContext)
  const documentDetailsIsOpen = useAppSelector(s =>
    selectDocumentDetailsPanelOpen(s, mode)
  )
  const ocrLang = useAppSelector(s => selectDocumentVersionOCRLang(s, mode))

  if (!docID || isLoading) {
    return (
      <div className={classes.documentDetailsOpened}>
        <DocumentDetailsToggle />
        <Stack className={classes.documentDetailsContent} justify="flex-start">
          <Skeleton height={"20"} />
          <Skeleton height={"20"} />
          <Skeleton height={"20"} />
        </Stack>
      </div>
    )
  }

  if (documentDetailsIsOpen) {
    return (
      <div className={classes.documentDetailsOpened}>
        <Stack className={classes.documentDetailsContent} justify="flex-start">
          <TextInput
            label="ID"
            readOnly
            value={docID}
            rightSection={<CopyButton value={docID || ""} />}
          />
          <TextInput
            label={t("common.version_id")}
            readOnly
            value={docVer?.id}
            rightSection={<CopyButton value={docVer?.id || ""} />}
          />
          <TextInput
            label={t("common.version_number")}
            readOnly
            value={docVer?.number}
            rightSection={<CopyButton value={`${docVer?.number}` || ""} />}
          />

          <TextInput
            label={t("common.owner")}
            readOnly
            value={doc?.owner_name || t(OWNER_ME)}
            rightSection={<CopyButton value={doc?.owner_name || t(OWNER_ME)} />}
          />
          <Group>
            <TagsInput
              rightSection={<EditTagsButton />}
              label={t("common.tags")}
              readOnly
              value={doc?.tags?.map(t => t.name) || []}
              mt="md"
            />
          </Group>
          <Group>
            <CustomFields docID={docID} doc={doc} isLoading={isLoading} />
          </Group>
          <TextInput
            label={t("common.ocr_language")}
            readOnly
            value={ocrLang}
            mt="md"
          />
          {docVer?.video_duration != null && (
            <Text mt="md">
              {t("common.duration")}: {formatDuration(docVer.video_duration)}
            </Text>
          )}
          {docVer?.video_width != null &&
            docVer.video_height != null && (
              <Text>
                {t("common.resolution")}: {docVer.video_width}×
                {docVer.video_height}
              </Text>
            )}
          {docVer?.video_codec && (
            <Text>
              {t("common.codec")}: {docVer.video_codec}
            </Text>
          )}
        </Stack>
      </div>
    )
  }

  return <></>
}

function EditTagsButton() {
  const [opened, {open, close}] = useDisclosure(false)
  const mode: PanelMode = useContext(PanelContext)
  const docID = useAppSelector(s => selectCurrentNodeID(s, mode))
  const {currentData: doc} = useGetDocumentQuery(docID ?? skipToken)

  const onClick = () => {
    open()
  }

  const onSubmit = () => {
    close()
  }

  const onCancel = () => {
    close()
  }

  return (
    <>
      <ActionIcon variant="default" onClick={onClick}>
        <IconEdit stroke={1.4} />
      </ActionIcon>
      {doc && (
        <EditNodeTagsModal
          opened={opened}
          node={doc}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      )}
    </>
  )
}
