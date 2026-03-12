import { useState } from 'react'
import { ChevronRight, Check, Loader2, AlertCircle, Zap } from 'lucide-react'
import type { DynamicToolUIPart } from 'ai'
import { cn } from '@/lib/utils'

export function ToolInvocation({ part }: { part: DynamicToolUIPart }) {
  const [open, setOpen] = useState(false)

  const isLoading = part.state === 'input-streaming' || part.state === 'input-available'
  const isError = part.state === 'output-error'
  const isDone = part.state === 'output-available'

  return (
    <div className="rounded-lg border bg-card text-card-foreground text-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Zap className="size-3.5 text-amber-500 shrink-0" />
        <span className="font-medium truncate flex-1 text-left">
          {part.toolName}
        </span>
        {isLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />}
        {isDone && <Check className="size-3.5 text-emerald-500 shrink-0" />}
        {isError && <AlertCircle className="size-3.5 text-destructive shrink-0" />}
        <ChevronRight
          className={cn(
            'size-3.5 text-muted-foreground transition-transform shrink-0',
            open && 'rotate-90',
          )}
        />
      </button>

      {open && (
        <div className="border-t px-3 py-2 space-y-2">
          {part.input != null && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Input</div>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-48">
                {typeof part.input === 'string'
                  ? part.input
                  : JSON.stringify(part.input, null, 2)}
              </pre>
            </div>
          )}
          {isDone && part.output != null && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Output</div>
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-48">
                {typeof part.output === 'string'
                  ? part.output
                  : JSON.stringify(part.output, null, 2)}
              </pre>
            </div>
          )}
          {isError && part.errorText && (
            <div>
              <div className="text-xs text-destructive mb-1">Error</div>
              <pre className="text-xs bg-destructive/10 rounded p-2 overflow-x-auto">
                {part.errorText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
