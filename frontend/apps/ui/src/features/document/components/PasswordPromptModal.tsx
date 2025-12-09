import {Button, Group, Modal, PasswordInput, Stack, Text} from "@mantine/core"
import {useState} from "react"
import {useTranslation} from "react-i18next"

interface Props {
  opened: boolean
  fileName: string
  onClose: () => void
  onSubmit: (password: string) => void
}

export default function PasswordPromptModal({
  opened,
  fileName,
  onClose,
  onSubmit
}: Props) {
  const {t} = useTranslation()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

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
            setError("")
          }}
          error={error}
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

