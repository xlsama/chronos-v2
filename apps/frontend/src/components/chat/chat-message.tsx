import type { IncidentMessage } from '@chronos/shared'
import { Info, User } from 'lucide-react'

import {
  Message,
  MessageContent,
} from '@/components/ui/message'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'

const messageWidthClass = 'mx-auto w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl'

interface ChatMessageProps {
  message: IncidentMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'system') {
    return (
      <div className={cn('px-4 py-2', messageWidthClass)}>
        <div className="flex items-start gap-2">
          <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
            <Info className="text-muted-foreground size-3.5" />
          </div>
          <p className="text-muted-foreground text-sm">{message.content}</p>
        </div>
      </div>
    )
  }

  const isUser = message.role === 'user'

  if (!isUser) {
    return (
      <div className={cn('px-4 py-2', messageWidthClass)}>
        <div className="prose dark:prose-invert prose-sm max-w-none">
          <Markdown>{message.content}</Markdown>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex justify-end px-4 py-2', messageWidthClass)}>
      <Message className="max-w-[85%] flex-row-reverse">
        <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <User className="size-4" />
        </div>
        <MessageContent className="bg-primary text-primary-foreground prose-invert">
          {message.content}
        </MessageContent>
      </Message>
    </div>
  )
}
