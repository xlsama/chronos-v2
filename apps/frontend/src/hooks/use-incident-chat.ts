import { useCallback, useRef, useState } from 'react'
import type { Message } from '@chronos/shared'

interface UseIncidentChatOptions {
  threadId: string
  incidentId?: string
  initialMessages?: Message[]
}

export function useIncidentChat({ threadId, incidentId, initialMessages = [] }: UseIncidentChatOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (content?: string) => {
    const text = content ?? input
    if (!text.trim() || isLoading) return

    // Add user message optimistically
    const userMessage: Message = {
      id: crypto.randomUUID(),
      threadId,
      incidentId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setStreamingContent('')

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, incidentId, message: text }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`Chat error: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setStreamingContent(fullText)
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        threadId,
        incidentId,
        role: 'assistant',
        content: fullText,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setStreamingContent('')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [input, isLoading, threadId, incidentId])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
  }, [])

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${threadId}/messages`)
      if (res.ok) {
        const { data } = await res.json() as { data: Message[] }
        setMessages(data)
      }
    } catch (error) {
      console.error('Failed to reload messages:', error)
    }
  }, [threadId])

  return {
    messages,
    input,
    setInput,
    isLoading,
    streamingContent,
    sendMessage,
    stop,
    reload,
  }
}
