import {Button, Group, Modal, PasswordInput, Stack, Text} from "@mantine/core"
import {useState} from "react"
import {useTranslation} from "react-i18next"

interface Props {
  opened: boolean
  fileName: string
  onClose: () => void
  onSubmit: (password: string) => void
  error?: string // External error message (e.g., from password validation)
}

export default function PasswordPromptModal({
  opened,
  fileName,
  onClose,
  onSubmit,
  error: externalError
}: Props) {
  const {t} = useTranslation()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  
  // Use external error if provided, otherwise use internal error
  const displayError = externalError || error

  const handleSubmit = () => {
    if (!password.trim()) {
      setError("Password is required")
      return
    }
    setError("")
    onSubmit(password)
    setPassword("")
  }

  const handleClose = () => {
    setPassword("")
    setError("")
    onClose()
  }

  return (
    <Modal
      title="Password Required"
      opened={opened}
      onClose={handleClose}
    >
      <Stack gap="md">
        <Text>
          This file is password protected. Please enter the password to view:
        </Text>
        <Text size="sm" c="dimmed">
          {fileName}
        </Text>
        <PasswordInput
          label="Password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => {
            setPassword(e.currentTarget.value)
            // Clear internal error when user types, but external error should be cleared by parent
            setError("")
          }}
          error={displayError}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSubmit()
            }
          }}
          autoFocus
        />
        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="default" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>
            {t("common.submit")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

