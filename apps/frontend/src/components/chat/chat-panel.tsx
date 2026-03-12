import type { UIMessage } from 'ai'

import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/ui/chat-container'
import { ScrollButton } from '@/components/ui/scroll-button'
import { ChatMessage } from './chat-message'

interface ChatPanelProps {
  messages: UIMessage[]
  isStreaming?: boolean
}

export function ChatPanel({ messages, isStreaming = false }: ChatPanelProps) {
  return (
    <ChatContainerRoot className="relative flex-1">
      <ChatContainerContent className="gap-1 py-4">
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            isStreaming={isStreaming && index === messages.length - 1}
          />
        ))}
        {isStreaming && messages.length > 0 && (
          <div className="mx-auto w-full max-w-2xl px-4 py-2 lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl">
            <div className="flex items-center gap-2">
              <div className="bg-primary size-2 animate-pulse rounded-full" />
              <span className="text-muted-foreground text-sm">AI 正在思考...</span>
            </div>
          </div>
        )}
        <ChatContainerScrollAnchor />
      </ChatContainerContent>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <ScrollButton />
      </div>
    </ChatContainerRoot>
  )
}
