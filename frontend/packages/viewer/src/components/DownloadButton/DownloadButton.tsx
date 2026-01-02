import {ActionIcon, Box, Loader, Menu, Text, Tooltip} from "@mantine/core"
import {IconDownload} from "@tabler/icons-react"
import type {ReactNode} from "react"
import classes from "./DownloadButton.module.css"
import type {DownloadDocumentVersion, I18NDownloadButtonText} from "./types"

interface Args {
  i18nIsReady?: boolean
  txt?: I18NDownloadButtonText
  versions?: DownloadDocumentVersion[] | null
  isLoading?: boolean // refers to the loading of the versions
  isError?: boolean
  onClick?: (documentVersionID: string) => void
  onOpen?: () => void
  onClose?: () => void
}

export default function DownloadButton({
  i18nIsReady = false,
  isLoading = false,
  isError = false,
  txt,
  onClick,
  onOpen,
  onClose,
  versions
}: Args) {
  const noVersions = !versions || versions.length == 0
  const icon = <IconDownload stroke={1.4} />

  // Use fallback text if i18n is not ready
  const fallbackTxt: I18NDownloadButtonText = {
    downloadInProgressTooltip: "Download in progress...",
    downloadTooltip: "Download document",
    loadingTooltip: "Loading...",
    error: "Error: Oops, it didn't work",
    emptyVersionsArrayError: "Error: empty version list",
    versionLabel: "Version"
  }
  const displayTxt = txt || fallbackTxt

  if (!i18nIsReady) {
    // Still show menu even if i18n isn't ready, using fallback text
    if (isLoading) {
      return (
        <DownloadMenu
          icon={icon}
          tooltip={displayTxt.loadingTooltip}
          onOpen={onOpen}
          onClose={onClose}
        >
          <Box p="md" mih={60} display="flex">
            <Loader size="md" />
          </Box>
        </DownloadMenu>
      )
    }

    if (isError) {
      return (
        <DownloadMenu
          icon={icon}
          onOpen={onOpen}
          tooltip={displayTxt.error}
        >
          <Text c="red">{displayTxt.error}</Text>
        </DownloadMenu>
      )
    }

    if (noVersions) {
      return (
        <DownloadMenu
          icon={icon}
          onOpen={onOpen}
          onClose={onClose}
          tooltip={displayTxt.downloadTooltip}
        >
          <Text c="red">{displayTxt.emptyVersionsArrayError}</Text>
        </DownloadMenu>
      )
    }

    const versionItems = versions.map(v => (
      <Menu.Item key={v.id} onClick={() => onClick?.(v.id)}>
        {`${displayTxt.versionLabel} ${v.number}${v.shortDescription ? ` - ${v.shortDescription}` : ""}`}
      </Menu.Item>
    ))

    return (
      <DownloadMenu
        icon={icon}
        tooltip={displayTxt.downloadTooltip}
        onOpen={onOpen}
        onClose={onClose}
      >
        {versionItems}
      </DownloadMenu>
    )
  }

  if (isLoading) {
    return (
      <DownloadMenu
        icon={icon}
        tooltip={displayTxt.loadingTooltip}
        onOpen={onOpen}
        onClose={onClose}
      >
        <Box p="md" mih={60} display="flex">
          <Loader size="md" />
        </Box>
      </DownloadMenu>
    )
  }

  if (isError) {
    return (
      <DownloadMenu
        icon={icon}
        onOpen={onOpen}
        tooltip={displayTxt.error}
      >
        <Text c="red">{displayTxt.error}</Text>
      </DownloadMenu>
    )
  }

  if (noVersions) {
    return (
      <DownloadMenu
        icon={icon}
        onOpen={onOpen}
        onClose={onClose}
        tooltip={displayTxt.downloadTooltip}
      >
        <Text c="red">{displayTxt.emptyVersionsArrayError}</Text>
      </DownloadMenu>
    )
  }

  const versionItems = versions.map(v => (
    <Menu.Item key={v.id} onClick={() => onClick?.(v.id)}>
      {`${displayTxt.versionLabel} ${v.number}${v.shortDescription ? ` - ${v.shortDescription}` : ""}`}
    </Menu.Item>
  ))

  return (
    <DownloadMenu
      icon={icon}
      tooltip={displayTxt.downloadTooltip}
      onOpen={onOpen}
      onClose={onClose}
    >
      {versionItems}
    </DownloadMenu>
  )
}

interface DownloadMenuArgs {
  icon: ReactNode
  tooltip?: string
  children?: ReactNode
  onOpen?: () => void
  onClose?: () => void
}

function DownloadMenu({
  icon,
  tooltip,
  onOpen,
  onClose,
  children
}: DownloadMenuArgs) {
  return (
    <Menu onOpen={onOpen} onClose={onClose}>
      <Menu.Target>
        <Tooltip label={tooltip} withArrow>
          <ActionIcon size="lg" variant="default">
            {icon}
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown p="sm" className={classes.menuDropdown}>
        {children}
      </Menu.Dropdown>
    </Menu>
  )
}
