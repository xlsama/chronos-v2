import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { ChatInput } from '@/components/chat/chat-input'
import { ChatPanel } from '@/components/chat/chat-panel'
import { IncidentHeader } from '@/components/chat/incident-header'
import { Spinner } from '@/components/ui/spinner'
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

  const messages: never[] = []
  const isAutoMode = incident.processingMode === 'automatic'

  return (
    <div className="flex h-[calc(100svh-1px)] flex-col">
      <IncidentHeader incident={incident} />
      <ChatPanel messages={messages} />
      <ChatInput disabled={isAutoMode} />
    </div>
  )
}
