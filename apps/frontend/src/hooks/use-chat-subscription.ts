import { useEffect, useRef } from 'react'

interface UseChatSubscriptionOptions {
  threadId: string | undefined
  onStreamStart?: () => void
  onStreamChunk?: (chunk: unknown) => void
  onStreamEnd?: (data: { threadId: string }) => void
  onStreamError?: (data: { error: string }) => void
  onMessage?: (data: unknown) => void
  enabled?: boolean
}

export function useChatSubscription({
  threadId,
  onStreamStart,
  onStreamChunk,
  onStreamEnd,
  onStreamError,
  onMessage,
  enabled = true,
}: UseChatSubscriptionOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!threadId || !enabled) return

    const es = new EventSource(`/api/chat/${threadId}/subscribe`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { event: string; data: unknown }
        switch (parsed.event) {
          case 'stream-start':
            onStreamStart?.()
            break
          case 'stream-chunk':
            onStreamChunk?.(parsed.data)
            break
          case 'stream-end':
            onStreamEnd?.(parsed.data as { threadId: string })
            break
          case 'stream-error':
            onStreamError?.(parsed.data as { error: string })
            break
          case 'message':
            onMessage?.(parsed.data)
            break
        }
      } catch {
        // Ignore parse errors (heartbeats, etc.)
      }
    }

    es.onerror = () => {
      // EventSource will auto-reconnect
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [threadId, enabled, onStreamStart, onStreamChunk, onStreamEnd, onStreamError, onMessage])

  return {
    close: () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    },
  }
}
