import { useState, useEffect, useCallback, useRef } from 'react'
import type { UIMessage } from 'ai'

interface UseChatSubscriptionOptions {
  threadId: string | null
  enabled?: boolean
  onDone?: () => void
}

export function useChatSubscription({ threadId, enabled = true, onDone }: UseChatSubscriptionOptions) {
  const [streamingMessage, setStreamingMessage] = useState<UIMessage | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!threadId || !enabled) return

    const eventSource = new EventSource(`/api/chat/${threadId}/subscribe`)
    setIsStreaming(true)

    // Accumulate parts for the streaming message
    let currentText = ''
    const toolInvocations = new Map<string, {
      toolCallId: string
      toolName: string
      args: Record<string, unknown>
      state: string
      result?: unknown
    }>()
    let reasoningText = ''
    const msgId = `stream-${Date.now()}`

    const buildMessage = (): UIMessage => {
      const parts: UIMessage['parts'] = []

      if (reasoningText) {
        parts.push({ type: 'reasoning' as const, reasoning: reasoningText, details: [] } as unknown as UIMessage['parts'][number])
      }

      for (const tool of toolInvocations.values()) {
        parts.push({
          type: 'tool-invocation' as const,
          toolInvocation: tool,
        } as unknown as UIMessage['parts'][number])
      }

      if (currentText) {
        parts.push({ type: 'text' as const, text: currentText })
      }

      return {
        id: msgId,
        role: 'assistant' as const,
        parts,
        createdAt: new Date(),
      } as UIMessage
    }

    eventSource.addEventListener('part', (e) => {
      try {
        const part = JSON.parse(e.data) as { type: string; [key: string]: unknown }

        switch (part.type) {
          case 'text-delta':
            currentText += (part.textDelta as string) ?? ''
            break
          case 'reasoning':
            reasoningText += (part.reasoning as string) ?? ''
            break
          case 'tool-call': {
            const toolCallId = part.toolCallId as string
            toolInvocations.set(toolCallId, {
              toolCallId,
              toolName: part.toolName as string,
              args: part.args as Record<string, unknown>,
              state: 'call',
            })
            break
          }
          case 'tool-result': {
            const id = part.toolCallId as string
            const existing = toolInvocations.get(id)
            if (existing) {
              existing.state = 'result'
              existing.result = part.result
            }
            break
          }
          case 'start':
          case 'finish':
          case 'step-start':
            // Lifecycle events, skip
            break
        }

        setStreamingMessage(buildMessage())
      } catch {
        // Ignore parse errors
      }
    })

    eventSource.addEventListener('done', () => {
      setIsStreaming(false)
      eventSource.close()
      onDoneRef.current?.()
    })

    eventSource.onerror = () => {
      setIsStreaming(false)
      eventSource.close()
    }

    return () => {
      eventSource.close()
      setIsStreaming(false)
      setStreamingMessage(null)
    }
  }, [threadId, enabled])

  const reset = useCallback(() => {
    setStreamingMessage(null)
    setIsStreaming(false)
  }, [])

  return { streamingMessage, isStreaming, reset }
}
