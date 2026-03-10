import { createFileRoute } from '@tanstack/react-router'

import { IncidentHeader } from '@/components/chat/incident-header'
import { ChatPanel } from '@/components/chat/chat-panel'
import { ChatInput } from '@/components/chat/chat-input'
import { mockIncidents, mockMessages } from '@/lib/mock-data'
import { NotFound } from '@/components/not-found'

export const Route = createFileRoute('/_app/inbox/$id')({
  component: IncidentDetailPage,
})

function IncidentDetailPage() {
  const { id } = Route.useParams()
  const incident = mockIncidents.find((i) => i.id === id)

  if (!incident) {
    return <NotFound />
  }

  const messages = mockMessages[id] ?? []
  const isAutoMode = incident.processingMode === 'automatic'

  return (
    <div className="flex h-[calc(100svh-1px)] flex-col">
      <IncidentHeader incident={incident} />
      <ChatPanel messages={messages} />
      <ChatInput disabled={isAutoMode} />
    </div>
  )
}
