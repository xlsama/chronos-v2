import type { IncidentMessage } from '@chronos/shared'

import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/ui/chat-container'
import { ScrollButton } from '@/components/ui/scroll-button'
import { ChatMessage } from './chat-message'

interface ChatPanelProps {
  messages: IncidentMessage[]
}

export function ChatPanel({ messages }: ChatPanelProps) {
  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="gap-1 py-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <ChatContainerScrollAnchor />
      </ChatContainerContent>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <ScrollButton />
      </div>
    </ChatContainerRoot>
  )
}
