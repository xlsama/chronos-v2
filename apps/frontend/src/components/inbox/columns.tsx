import type { ColumnDef } from '@tanstack/react-table'
import type { Incident } from '@chronos/shared'
import { Link } from '@tanstack/react-router'
import { ArrowUpDown, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const severityConfig = {
  critical: { label: 'Critical', className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20' },
  high: { label: 'High', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20' },
  medium: { label: 'Medium', className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20' },
  low: { label: 'Low', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20' },
} as const

const statusConfig = {
  new: { label: '新建', className: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20' },
  triaging: { label: '分诊中', className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20' },
  in_progress: { label: '处理中', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  waiting_human: { label: '等待确认', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  resolved: { label: '已解决', className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20' },
  closed: { label: '已关闭', className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20' },
} as const

export const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: 'title',
    header: '标题',
    cell: ({ row }) => (
      <Link
        to="/inbox/$id"
        params={{ id: row.original.id }}
        className="font-medium hover:underline"
      >
        {row.getValue('title')}
      </Link>
    ),
  },
  {
    accessorKey: 'severity',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        严重程度
        <ArrowUpDown className="ml-1 size-3.5" />
      </Button>
    ),
    cell: ({ row }) => {
      const severity = row.getValue('severity') as keyof typeof severityConfig
      const config = severityConfig[severity]
      return (
        <Badge variant="outline" className={config.className}>
          {config.label}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'status',
    header: '状态',
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
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue('source')}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
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
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-sm" asChild>
        <Link to="/inbox/$id" params={{ id: row.original.id }}>
          <Eye className="size-4" />
        </Link>
      </Button>
    ),
  },
]
