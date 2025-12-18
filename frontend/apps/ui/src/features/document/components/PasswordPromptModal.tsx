import {Button, Group, Modal, PasswordInput, Stack, Text} from "@mantine/core"
import {useState} from "react"
import {useTranslation} from "react-i18next"

interface Props {
  opened: boolean
  fileName: string
  onClose: () => void
  onSubmit: (password: string) => void | Promise<void> // Can be async
  error?: string // External error message (e.g., from password validation)
  onErrorClear?: () => void // Callback to clear external error when user types
}

export default function PasswordPromptModal({
  opened,
  fileName,
  onClose,
  onSubmit,
  error: externalError,
  onErrorClear
}: Props) {
  const {t} = useTranslation()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Use external error if provided, otherwise use internal error
  const displayError = externalError || error

  const handleSubmit = async () => {
    if (!password.trim()) {
      setError("Password is required")
      return
    }
    if (isSubmitting) return // Prevent double submission
    
    setError("")
    if (onErrorClear) onErrorClear() // Clear external error when submitting
    setIsSubmitting(true)
    
    try {
      // onSubmit might be async, so await it
      await onSubmit(password)
      // Only clear password if onSubmit didn't throw (success case)
      // If it throws, the error will be handled by the parent
      setPassword("")
    } catch (error) {
      // Error is handled by parent component
      console.error("[PasswordPromptModal] Submit error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    // Allow closing even during submission (downloads can continue in background)
    // Only prevent closing if we want to block it (e.g., for viewing documents)
    setPassword("")
    setError("")
    if (onErrorClear) onErrorClear() // Clear external error when closing
    onClose()
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    // Clear internal error when user types
    setError("")
    // Also clear external error if callback provided
    if (onErrorClear && externalError) {
      onErrorClear()
    }
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
          onChange={(e) => handlePasswordChange(e.currentTarget.value)}
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
          <Button onClick={handleSubmit} loading={isSubmitting}>
            {t("common.submit")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

