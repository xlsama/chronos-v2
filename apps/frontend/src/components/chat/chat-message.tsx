import type { UIMessage } from 'ai'
import { Info, User, Wrench, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import {
  Message,
  MessageContent,
} from '@/components/ui/message'
import { Markdown } from '@/components/ui/markdown'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ui/reasoning'
import { cn } from '@/lib/utils'

const messageWidthClass = 'mx-auto w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl'

interface ChatMessageProps {
  message: UIMessage
  isStreaming?: boolean
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  if (message.role === 'system') {
    const text = message.parts?.find((p) => p.type === 'text') as { type: 'text'; text: string } | undefined
    return (
      <div className={cn('px-4 py-2', messageWidthClass)}>
        <div className="flex items-start gap-2">
          <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
            <Info className="text-muted-foreground size-3.5" />
          </div>
          <p className="text-muted-foreground text-sm">{text?.text ?? ''}</p>
        </div>
      </div>
    )
  }

  if (message.role === 'user') {
    const text = message.parts?.find((p) => p.type === 'text') as { type: 'text'; text: string } | undefined
    return (
      <div className={cn('flex justify-end px-4 py-2', messageWidthClass)}>
        <Message className="max-w-[85%] flex-row-reverse">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <User className="size-4" />
          </div>
          <MessageContent className="bg-primary text-primary-foreground prose-invert">
            {text?.text ?? ''}
          </MessageContent>
        </Message>
      </div>
    )
  }

  // Assistant message - render parts
  return (
    <div className={cn('px-4 py-2', messageWidthClass)}>
      <div className="flex flex-col gap-3">
        {message.parts?.map((part, index) => {
          switch (part.type) {
            case 'text':
              return (
                <div key={index} className="prose dark:prose-invert prose-sm max-w-none">
                  <Markdown>{(part as { type: 'text'; text: string }).text}</Markdown>
                </div>
              )

            case 'reasoning':
              return (
                <Reasoning key={index} isStreaming={isStreaming}>
                  <ReasoningTrigger className="text-muted-foreground text-sm">思考过程</ReasoningTrigger>
                  <ReasoningContent markdown className="ml-2 mt-1 border-l-2 border-l-muted px-3">
                    {(part as { type: 'reasoning'; reasoning: string }).reasoning}
                  </ReasoningContent>
                </Reasoning>
              )

            case 'tool-invocation':
              return <ToolInvocationPart key={index} part={part as ToolInvocationPartType} />

            default:
              return null
          }
        })}
      </div>
    </div>
  )
}

type ToolInvocationPartType = {
  type: 'tool-invocation'
  toolInvocation: {
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    state: string
    result?: unknown
  }
}

function ToolInvocationPart({ part }: { part: ToolInvocationPartType }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { toolInvocation } = part
  const isComplete = toolInvocation.state === 'result'

  return (
    <div className="border-border/50 bg-muted/30 rounded-lg border">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Wrench className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground font-medium">
          {toolInvocation.toolName}
        </span>
        {!isComplete && (
          <span className="bg-primary/10 text-primary animate-pulse rounded px-1.5 py-0.5 text-xs">
            执行中...
          </span>
        )}
        {isComplete && (
          <span className="text-muted-foreground/60 text-xs">完成</span>
        )}
        <ChevronRight
          className={cn(
            'text-muted-foreground/50 ml-auto size-3.5 transition-transform',
            isExpanded && 'rotate-90',
          )}
        />
      </button>
      {isExpanded && (
        <div className="border-border/50 space-y-2 border-t px-3 py-2">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">输入</p>
            <pre className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs">
              {JSON.stringify(toolInvocation.args, null, 2)}
            </pre>
          </div>
          {isComplete && toolInvocation.result !== undefined && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">输出</p>
              <pre className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs">
                {typeof toolInvocation.result === 'string'
                  ? toolInvocation.result
                  : JSON.stringify(toolInvocation.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
