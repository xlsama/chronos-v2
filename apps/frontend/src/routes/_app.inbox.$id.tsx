import { useMemo, useCallback } from 'react'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { ChatInput } from '@/components/chat/chat-input'
import { ChatPanel } from '@/components/chat/chat-panel'
import { IncidentHeader } from '@/components/chat/incident-header'
import { Spinner } from '@/components/ui/spinner'
import { useIncidentChat } from '@/hooks/use-incident-chat'
import { useChatSubscription } from '@/hooks/use-chat-subscription'
import { incidentQueries } from '@/lib/queries/incidents'

export const Route = createFileRoute('/_app/inbox/$id')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(incidentQueries.detail(params.id)),
  pendingComponent: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
  component: IncidentDetailPage,
})

function IncidentDetailPage() {
  const { id } = Route.useParams()
  const { data: incident } = useSuspenseQuery(incidentQueries.detail(id))
  const queryClient = useQueryClient()

  const isAutoMode = incident.processingMode === 'automatic'

  // useChat - for active chatting + loading history
  const chat = useIncidentChat(id, incident.threadId)

  // SSE subscription - for auto-triggered events
  // Don't subscribe when useChat itself is streaming (avoid duplicates)
  const subscription = useChatSubscription({
    threadId: incident.threadId,
    enabled: isAutoMode && !chat.isStreaming,
    onDone: () => {
      // Refetch messages to get the saved version
      if (incident.threadId) {
        queryClient.invalidateQueries({ queryKey: ['chat', 'messages', incident.threadId] })
      }
    },
  })

  // Merge messages: useChat history/realtime + SSE streaming message
  const allMessages = useMemo(() => {
    const msgs = [...chat.messages]
    if (subscription.streamingMessage) {
      msgs.push(subscription.streamingMessage)
    }
    return msgs
  }, [chat.messages, subscription.streamingMessage])

  const isStreaming = chat.isStreaming || subscription.isStreaming

  const handleSubmit = useCallback((text: string, knowledgeBaseIds?: string[]) => {
    chat.sendMessage(
      { text },
      knowledgeBaseIds ? { body: { knowledgeBaseIds } } : undefined,
    )
  }, [chat.sendMessage])

  return (
    <div className="flex h-[calc(100svh-1px)] flex-col">
      <IncidentHeader incident={incident} />
      <ChatPanel messages={allMessages} isStreaming={isStreaming} />
      <ChatInput
        disabled={isAutoMode || isStreaming}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
