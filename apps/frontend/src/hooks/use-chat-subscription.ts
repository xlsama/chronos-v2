import { useEffect, useRef } from 'react'

interface UseChatSubscriptionOptions {
  threadId: string | undefined
  onMessage?: (data: { event: string; data: unknown }) => void
  enabled?: boolean
}

export function useChatSubscription({ threadId, onMessage, enabled = true }: UseChatSubscriptionOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!threadId || !enabled) return

    const es = new EventSource(`/api/chat/${threadId}/subscribe`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        onMessage?.(parsed)
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
  }, [threadId, enabled, onMessage])

  return {
    close: () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    },
  }
}
