import { useState } from 'react'
import { Bot, ChevronRight, Loader2, Check } from 'lucide-react'
import type { DynamicToolUIPart } from 'ai'
import { cn } from '@/lib/utils'
import { MarkdownStream } from './markdown-stream'

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  knowledgeAgent: '知识库 Agent',
  runbookAgent: 'Runbook Agent',
  incidentHistoryAgent: '历史事件 Agent',
}

export const SUB_AGENT_NAMES = Object.keys(AGENT_DISPLAY_NAMES)

export function AgentActivity({ part }: { part: DynamicToolUIPart }) {
  const [open, setOpen] = useState(false)

  const isLoading = part.state === 'input-streaming' || part.state === 'input-available'
  const isDone = part.state === 'output-available'
  const displayName = AGENT_DISPLAY_NAMES[part.toolName] ?? part.toolName

  const query = typeof part.input === 'object' && part.input !== null
    ? (part.input as Record<string, unknown>).message ?? (part.input as Record<string, unknown>).query ?? ''
    : ''

  const resultText = isDone && part.output != null
    ? typeof part.output === 'string'
      ? part.output
      : JSON.stringify(part.output, null, 2)
    : ''

  return (
    <div className="rounded-lg border bg-card text-card-foreground text-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Bot className="size-3.5 text-blue-500 shrink-0" />
        <span className="font-medium truncate flex-1 text-left">
          {displayName}
        </span>
        {isLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />}
        {isDone && <Check className="size-3.5 text-emerald-500 shrink-0" />}
        <ChevronRight
          className={cn(
            'size-3.5 text-muted-foreground transition-transform shrink-0',
            open && 'rotate-90',
          )}
        />
      </button>

      {open && (
        <div className="border-t px-3 py-2 space-y-2">
          {query && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Query</div>
              <p className="text-xs text-foreground">{String(query)}</p>
            </div>
          )}
          {resultText && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Result</div>
              <div className="text-xs max-h-64 overflow-y-auto">
                <MarkdownStream>{resultText}</MarkdownStream>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
