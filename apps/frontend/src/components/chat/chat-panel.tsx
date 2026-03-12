import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Send, Square } from 'lucide-react'
import { ChatContainerRoot, ChatContainerContent, ChatContainerScrollAnchor } from '@/components/ui/chat-container'
import { PromptInput, PromptInputTextarea, PromptInputActions, PromptInputAction } from '@/components/ui/prompt-input'
import { Button } from '@/components/ui/button'
import { ChatMessage } from './chat-message'

interface ChatPanelProps {
  threadId: string
  incidentId?: string
  className?: string
}

export function ChatPanel({ threadId, incidentId, className }: ChatPanelProps) {
  const [input, setInput] = useState('')

  // Load initial messages from server
  const { data: initialMessages } = useQuery({
    queryKey: ['chat-messages', threadId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/${threadId}/messages`)
      if (!res.ok) return []
      return (await res.json()) as UIMessage[]
    },
  })

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { threadId, incidentId },
      }),
    [threadId, incidentId],
  )

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: threadId,
    transport,
    experimental_throttle: 50,
  })

  // Sync initial messages when loaded
  useEffect(() => {
    if (initialMessages?.length) {
      setMessages(initialMessages)
    }
  }, [initialMessages, setMessages])

  const isStreaming = status === 'streaming'
  const isLoading = status === 'submitted' || isStreaming

  const handleSubmit = () => {
    const text = input.trim()
    if (!text || isLoading) return
    sendMessage({ text })
    setInput('')
  }

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      <ChatContainerRoot className="flex-1 min-h-0">
        <ChatContainerContent className="gap-4 p-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              开始与 Agent 对话，分析和解决此事件...
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isStreaming={
                isStreaming &&
                msg === messages[messages.length - 1] &&
                msg.role === 'assistant'
              }
            />
          ))}

          {status === 'submitted' && (
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                A
              </div>
              <div className="rounded-lg p-2 bg-secondary">
                <div className="flex items-center gap-1.5">
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse" />
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse [animation-delay:150ms]" />
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <div className="border-t p-4">
        <PromptInput
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          onSubmit={handleSubmit}
        >
          <PromptInputTextarea placeholder="输入消息与 Agent 对话..." />
          <PromptInputActions className="justify-end px-2 pb-2">
            {isLoading ? (
              <PromptInputAction tooltip="停止">
                <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={stop}>
                  <Square className="size-4" />
                </Button>
              </PromptInputAction>
            ) : (
              <PromptInputAction tooltip="发送">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full"
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                >
                  <Send className="size-4" />
                </Button>
              </PromptInputAction>
            )}
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  )
}
