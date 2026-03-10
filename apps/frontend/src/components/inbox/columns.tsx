import type { ColumnDef } from '@tanstack/react-table'
import type { Incident } from '@chronos/shared'
import { Link } from '@tanstack/react-router'
import { ArrowUpDown, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertContentCell } from './alert-content-cell'

const statusConfig = {
  new: { label: '新建', className: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20' },
  triaging: { label: '分诊中', className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20' },
  in_progress: { label: '处理中', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  waiting_human: { label: '等待确认', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  resolved: { label: '已解决', className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20' },
  closed: { label: '已关闭', className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20' },
} as const

const sourceConfig: Record<string, { label: string; className: string }> = {
  webhook: { label: 'Webhook', className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/20' },
  manual: { label: '手动', className: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/20' },
}

export const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: 'content',
    header: '告警信息',
    cell: ({ row }) => <AlertContentCell incident={row.original} />,
  },
  {
    accessorKey: 'status',
    header: '状态',
    size: 100,
    cell: ({ row }) => {
      const status = row.getValue('status') as keyof typeof statusConfig
      const config = statusConfig[status]
      return (
        <Badge variant="outline" className={config.className}>
          {config.label}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'source',
    header: '来源',
    size: 100,
    cell: ({ row }) => {
      const source = row.getValue('source') as string | null
      const config = source ? sourceConfig[source] : null
      if (config) {
        return (
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        )
      }
      return <span className="text-muted-foreground">{source ?? '-'}</span>
    },
  },
  {
    accessorKey: 'createdAt',
    size: 120,
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        创建时间
        <ArrowUpDown className="ml-1 size-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDistanceToNow(new Date(row.getValue('createdAt')), {
          addSuffix: true,
          locale: zhCN,
        })}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    size: 50,
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-sm" asChild>
        <Link to="/inbox/$id" params={{ id: row.original.id }}>
          <MessageSquare className="size-4" />
        </Link>
      </Button>
    ),
  },
]
