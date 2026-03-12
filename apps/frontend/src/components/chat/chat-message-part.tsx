import type { UIMessagePart } from 'ai'
import { MarkdownStream } from './markdown-stream'
import { ToolInvocation } from './tool-invocation'
import { AgentActivity, SUB_AGENT_NAMES } from './agent-activity'
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ui/reasoning'

export function ChatMessagePart({
  part,
  isStreaming,
}: {
  part: UIMessagePart
  isStreaming?: boolean
}) {
  switch (part.type) {
    case 'text':
      if (!part.text) return null
      return (
        <MarkdownStream isStreaming={isStreaming && part.state === 'streaming'}>
          {part.text}
        </MarkdownStream>
      )

    case 'reasoning':
      return (
        <Reasoning isStreaming={isStreaming && part.state === 'streaming'}>
          <ReasoningTrigger className="text-xs text-muted-foreground">
            思考过程
          </ReasoningTrigger>
          <ReasoningContent markdown>
            {part.text}
          </ReasoningContent>
        </Reasoning>
      )

    case 'dynamic-tool':
      if (SUB_AGENT_NAMES.includes(part.toolName)) {
        return <AgentActivity part={part} />
      }
      return <ToolInvocation part={part} />

    case 'step-start':
      return null

    default:
      return null
  }
}
