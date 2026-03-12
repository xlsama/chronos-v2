import type { UIMessage } from 'ai'
import { Message, MessageAvatar } from '@/components/ui/message'
import { ChatMessagePart } from './chat-message-part'

export function ChatMessage({
  message,
  isStreaming,
}: {
  message: UIMessage
  isStreaming?: boolean
}) {
  return (
    <Message className={message.role === 'user' ? 'flex-row-reverse' : ''}>
      <MessageAvatar
        src=""
        alt={message.role}
        fallback={message.role === 'user' ? 'U' : 'A'}
        className={message.role === 'assistant' ? 'bg-primary/10' : 'bg-muted'}
      />
      <div
        className={`flex flex-col gap-1.5 ${
          message.role === 'user'
            ? 'max-w-[80%]'
            : 'max-w-[85%]'
        }`}
      >
        {message.role === 'user' ? (
          <div className="rounded-lg p-2 bg-primary text-primary-foreground break-words whitespace-normal text-sm">
            {message.parts
              .filter((p) => p.type === 'text')
              .map((p) => (p as { type: 'text'; text: string }).text)
              .join('')}
          </div>
        ) : (
          message.parts.map((part, i) => (
            <ChatMessagePart key={i} part={part} isStreaming={isStreaming} />
          ))
        )}
      </div>
    </Message>
  )
}
