import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, Check, X, Clock, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useDecideApproval } from '@/lib/queries/tool-approvals'
import { cn } from '@/lib/utils'
import type { RiskLevel } from '@chronos/shared'

export interface ApprovalPayload {
  approvalId: string
  runId: string
  toolKey: string
  toolName: string
  connectionName: string
  connectionType: string
  riskLevel: RiskLevel
  input: Record<string, unknown>
  description: string
}

interface ApprovalCardProps {
  payload: ApprovalPayload
  expiresAt?: string
}

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; icon: string }> = {
  none: { label: '安全', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: '' },
  low: { label: '低风险', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: '' },
  medium: { label: '中风险', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: '' },
  high: { label: '危险', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: '' },
}

function formatInput(input: Record<string, unknown>): string {
  // Check for SQL content
  for (const key of ['sql', 'query', 'statement', 'command', 'script']) {
    if (typeof input[key] === 'string') return input[key] as string
  }
  return JSON.stringify(input, null, 2)
}

function isSQLContent(input: Record<string, unknown>): boolean {
  for (const key of ['sql', 'query', 'statement', 'command', 'script']) {
    if (typeof input[key] === 'string') return true
  }
  return false
}

export function ApprovalCard({ payload, expiresAt }: ApprovalCardProps) {
  const [decided, setDecided] = useState<'approved' | 'declined' | null>(null)
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [reason, setReason] = useState('')
  const [timeLeft, setTimeLeft] = useState('')
  const decideMutation = useDecideApproval()

  const riskConfig = RISK_CONFIG[payload.riskLevel]
  const inputDisplay = formatInput(payload.input)
  const isSQL = isSQLContent(payload.input)

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || decided) return

    const update = () => {
      const remaining = new Date(expiresAt).getTime() - Date.now()
      if (remaining <= 0) {
        setTimeLeft('已过期')
        return
      }
      const minutes = Math.floor(remaining / 60000)
      const seconds = Math.floor((remaining % 60000) / 1000)
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, decided])

  const handleApprove = useCallback(() => {
    decideMutation.mutate(
      { id: payload.approvalId, approved: true },
      { onSuccess: () => setDecided('approved') },
    )
  }, [decideMutation, payload.approvalId])

  const handleDecline = useCallback(() => {
    if (!showReasonInput) {
      setShowReasonInput(true)
      return
    }
    decideMutation.mutate(
      { id: payload.approvalId, approved: false, reason: reason || undefined },
      { onSuccess: () => setDecided('declined') },
    )
  }, [decideMutation, payload.approvalId, showReasonInput, reason])

  if (decided) {
    return (
      <Card className={cn(
        'max-w-lg border',
        decided === 'approved' ? 'border-green-200 dark:border-green-900' : 'border-red-200 dark:border-red-900',
      )}>
        <CardContent className="flex items-center gap-2 py-3">
          {decided === 'approved' ? (
            <>
              <Check className="size-4 text-green-600" />
              <span className="text-sm text-green-700 dark:text-green-400">已批准执行 {payload.toolName}</span>
            </>
          ) : (
            <>
              <X className="size-4 text-red-600" />
              <span className="text-sm text-red-700 dark:text-red-400">
                已拒绝 {payload.toolName}
                {reason && <span className="text-muted-foreground"> - {reason}</span>}
              </span>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-lg border border-yellow-200 dark:border-yellow-900">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <AlertTriangle className="size-4 text-yellow-600" />
        <span className="text-sm font-medium">需要人工审批</span>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <span className="text-muted-foreground">工具</span>
          <span className="font-mono text-xs">
            {payload.connectionName} / {payload.toolName}
          </span>
          <span className="text-muted-foreground">连接类型</span>
          <span>{payload.connectionType}</span>
          <span className="text-muted-foreground">风险等级</span>
          <Badge variant="outline" className={cn('w-fit', riskConfig.color)}>
            <ShieldAlert className="mr-1 size-3" />
            {riskConfig.label}
          </Badge>
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground text-sm">操作内容</span>
          <pre className={cn(
            'bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs',
            isSQL && 'font-mono',
          )}>
            {inputDisplay}
          </pre>
        </div>

        {showReasonInput && (
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="拒绝原因（可选）"
            className="text-sm"
            rows={2}
          />
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-0">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={decideMutation.isPending}
          >
            <Check className="mr-1 size-3.5" />
            批准执行
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDecline}
            disabled={decideMutation.isPending}
          >
            <X className="mr-1 size-3.5" />
            拒绝
          </Button>
        </div>
        {timeLeft && (
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Clock className="size-3" />
            {timeLeft}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
