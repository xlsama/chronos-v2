import type { ColumnDef } from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { MessageCircle, CircleStop } from 'lucide-react'
import type { Incident } from '@chronos/shared'
import { AlertCell } from '@/components/ops/alert-cell'
import { StatusBadge, processingModeLabelMap, sourceLabelMap } from '@/components/ops/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

function ActionsCell({ incident }: { incident: Incident }) {
  const showStop = incident.status === 'triaging'
  const threadId = `incident-${incident.id}`

  const handleAbort = () => {
    fetch(`/api/chat/${threadId}/abort`, { method: 'POST' })
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" asChild>
        <Link to="/inbox/$id" params={{ id: incident.id }}>
          <MessageCircle className="size-4" />
        </Link>
      </Button>
      {showStop && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <CircleStop className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>停止 Agent</AlertDialogTitle>
              <AlertDialogDescription>
                确定要停止当前正在运行的 Agent 吗？Agent 将中断分析并清理相关连接，之后你仍可以手动发起新的对话。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleAbort}>
                停止
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

export const incidentColumns: ColumnDef<Incident, unknown>[] = [
  {
    id: 'alert',
    header: '告警信息',
    cell: ({ row }) => <AlertCell incident={row.original} />,
    size: 420,
  },
  {
    id: 'status',
    header: '状态',
    cell: ({ row }) => <StatusBadge value={row.original.status} />,
    size: 120,
  },
  {
    id: 'source',
    header: '来源',
    cell: ({ row }) => (
      <Badge variant="secondary" className="rounded-full">
        {(row.original.source && sourceLabelMap[row.original.source]) ?? row.original.source ?? '-'}
      </Badge>
    ),
    size: 100,
  },
  {
    id: 'mode',
    header: '模式',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {(row.original.processingMode && processingModeLabelMap[row.original.processingMode]) ?? row.original.processingMode ?? '-'}
      </span>
    ),
    size: 100,
  },
  {
    id: 'createdAt',
    header: '创建时间',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {dayjs(row.original.createdAt).format('YYYY-MM-DD HH:mm:ss')}
      </span>
    ),
    size: 180,
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <ActionsCell incident={row.original} />,
    size: 80,
  },
]
