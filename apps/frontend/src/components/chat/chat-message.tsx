import type { IncidentMessage } from '@chronos/shared'
import { Info, User } from 'lucide-react'

import {
  Message,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  message: IncidentMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'system') {
    return (
      <div className="flex items-start gap-2 px-4 py-2">
        <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
          <Info className="text-muted-foreground size-3.5" />
        </div>
        <p className="text-muted-foreground text-sm">{message.content}</p>
      </div>
    )
  }

  const isUser = message.role === 'user'

  return (
    <div className={cn('px-4 py-2', isUser && 'flex justify-end')}>
      <Message className={cn('max-w-[85%]', isUser && 'flex-row-reverse')}>
        {isUser ? (
          <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <User className="size-4" />
          </div>
        ) : (
          <MessageAvatar src="" alt="AI" fallback="AI" />
        )}
        <MessageContent
          markdown={!isUser}
          className={cn(
            isUser
              ? 'bg-primary text-primary-foreground prose-invert'
              : 'bg-secondary',
          )}
        >
          {message.content}
        </MessageContent>
      </Message>
    </div>
  )
}
