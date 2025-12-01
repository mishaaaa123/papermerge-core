import {useEffect, useState} from "react"
import {Alert, Center, Loader, Stack, Text} from "@mantine/core"

import {getBaseURL} from "@/utils"
import client from "@/httpClient"

interface Props {
  docId: string
  fileName: string
}

export default function VideoPlayer({docId, fileName}: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchDownloadURL() {
      try {
        setIsLoading(true)
        setError(null)

        // 1) Ask backend for the last version; it includes `download_url`
        const resp = await client.get<{
          id: string
          download_url: string
        }>(`/api/documents/${docId}/last-version/`)
        let url = resp.data.download_url

        // 2) If backend returns a relative /api path, prefix with backend base URL
        if (url && url.startsWith("/api/")) {
          url = `${getBaseURL(true)}${url}`
        }

        if (!cancelled) {
          setVideoUrl(url)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.message || "Could not get video URL. Please try again later."
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchDownloadURL()

    return () => {
      cancelled = true
    }
  }, [docId])

  if (isLoading) {
    return (
      <Center style={{height: "100%"}}>
        <Loader />
      </Center>
    )
  }

  if (error || !videoUrl) {
    return (
      <Center style={{height: "100%"}}>
        <Alert color="red" title="Video unavailable">
          <Text>{error || "Video URL is missing."}</Text>
        </Alert>
      </Center>
    )
  }

  return (
    <Center style={{height: "100%", width: "100%"}}>
      <Stack style={{width: "100%", maxWidth: 960}}>
        <video
          style={{width: "100%", maxHeight: "70vh"}}
          controls
          src={videoUrl}
        >
          Your browser does not support the video tag.
        </video>
        <Text size="sm" c="dimmed">
          {fileName}
        </Text>
      </Stack>
    </Center>
  )
}


