import { useEffect } from 'react'
import { Bot, Send, Square, User } from 'lucide-react'
import { ChatContainerRoot, ChatContainerContent, ChatContainerScrollAnchor } from '@/components/ui/chat-container'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import { PromptInput, PromptInputTextarea, PromptInputActions, PromptInputAction } from '@/components/ui/prompt-input'
import { Button } from '@/components/ui/button'
import { useIncidentChat } from '@/hooks/use-incident-chat'

interface ChatPanelProps {
  threadId: string
  incidentId?: string
  className?: string
}

export function ChatPanel({ threadId, incidentId, className }: ChatPanelProps) {
  const {
    messages,
    input,
    setInput,
    isLoading,
    streamingContent,
    sendMessage,
    stop,
    reload,
  } = useIncidentChat({ threadId, incidentId })

  useEffect(() => {
    reload()
  }, [reload])

  const handleSubmit = () => {
    if (input.trim()) {
      sendMessage()
    }
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
            <Message key={msg.id} className={msg.role === 'user' ? 'flex-row-reverse' : ''}>
              <MessageAvatar
                src=""
                alt={msg.role}
                fallback={msg.role === 'user' ? 'U' : 'A'}
                className={msg.role === 'assistant' ? 'bg-primary/10' : 'bg-muted'}
              />
              <MessageContent
                markdown={msg.role === 'assistant'}
                className={
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground max-w-[80%]'
                    : 'bg-secondary max-w-[85%]'
                }
              >
                {msg.content ?? ''}
              </MessageContent>
            </Message>
          ))}

          {streamingContent && (
            <Message>
              <MessageAvatar src="" alt="assistant" fallback="A" className="bg-primary/10" />
              <MessageContent markdown className="bg-secondary max-w-[85%]">
                {streamingContent}
              </MessageContent>
            </Message>
          )}

          {isLoading && !streamingContent && (
            <Message>
              <MessageAvatar src="" alt="assistant" fallback="A" className="bg-primary/10" />
              <MessageContent className="bg-secondary">
                <div className="flex items-center gap-1.5">
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse" />
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse [animation-delay:150ms]" />
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse [animation-delay:300ms]" />
                </div>
              </MessageContent>
            </Message>
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
