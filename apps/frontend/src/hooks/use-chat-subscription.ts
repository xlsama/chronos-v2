import { useEffect, useRef } from 'react'
import type { ApprovalRequiredEvent } from '@chronos/shared'

interface UseChatSubscriptionOptions {
  threadId: string | undefined
  onStreamStart?: () => void
  onStreamChunk?: (chunk: unknown) => void
  onStreamEnd?: (data: { threadId: string }) => void
  onStreamAborted?: (data: { threadId: string }) => void
  onStreamError?: (data: { error: string }) => void
  onMessage?: (data: unknown) => void
  onApprovalRequired?: (data: ApprovalRequiredEvent) => void
  onApprovalResolved?: (data: { id: string; action: 'approve' | 'decline' }) => void
  enabled?: boolean
}

export function useChatSubscription({
  threadId,
  onStreamStart,
  onStreamChunk,
  onStreamEnd,
  onStreamAborted,
  onStreamError,
  onMessage,
  onApprovalRequired,
  onApprovalResolved,
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
          case 'stream-aborted':
            onStreamAborted?.(parsed.data as { threadId: string })
            break
          case 'stream-error':
            onStreamError?.(parsed.data as { error: string })
            break
          case 'message':
            onMessage?.(parsed.data)
            break
          case 'approval-required':
            onApprovalRequired?.(parsed.data as ApprovalRequiredEvent)
            break
          case 'approval-resolved':
            onApprovalResolved?.(parsed.data as { id: string; action: 'approve' | 'decline' })
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
  }, [threadId, enabled, onStreamStart, onStreamChunk, onStreamEnd, onStreamAborted, onStreamError, onMessage, onApprovalRequired, onApprovalResolved])

  return {
    close: () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    },
  }
}
