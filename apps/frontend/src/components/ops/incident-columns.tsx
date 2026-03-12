import type { ColumnDef } from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { MessageCircle } from 'lucide-react'
import type { Incident } from '@chronos/shared'
import { AlertCell } from '@/components/ops/alert-cell'
import { StatusBadge, processingModeLabelMap, sourceLabelMap } from '@/components/ops/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
    cell: ({ row }) => (
      <Button variant="ghost" size="icon" asChild>
        <Link to="/inbox/$id" params={{ id: row.original.id }}>
          <MessageCircle className="size-4" />
        </Link>
      </Button>
    ),
    size: 50,
  },
]
