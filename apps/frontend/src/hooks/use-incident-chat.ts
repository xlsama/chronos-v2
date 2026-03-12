import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export function useIncidentChat(incidentId: string, threadId: string | null) {
  // Load history messages (if threadId exists)
  const { data: historyMessages } = useQuery({
    queryKey: ['chat', 'messages', threadId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/${threadId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const json = await res.json() as { data: UIMessage[] }
      return json.data
    },
    enabled: !!threadId,
  })

  const chat = useChat({
    id: threadId ?? undefined,
    initialMessages: historyMessages ?? [],
    transport: useMemo(() => new DefaultChatTransport({
      api: '/api/chat',
      body: { incidentId },
    }), [incidentId]),
  })

  return {
    messages: chat.messages,
    sendMessage: chat.sendMessage,
    status: chat.status,
    error: chat.error,
    isStreaming: chat.status === 'streaming',
  }
}
