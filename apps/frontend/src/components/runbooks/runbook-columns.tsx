import type { ColumnDef } from '@tanstack/react-table'
import type { Runbook } from '@chronos/shared'
import { format } from 'date-fns'
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ColumnOptions {
  onEdit: (runbook: Runbook) => void
  onDelete: (id: string) => void
}

export function getRunbookColumns({ onEdit, onDelete }: ColumnOptions): ColumnDef<Runbook>[] {
  return [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          标题
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">{row.getValue('title')}</span>,
    },
    {
      accessorKey: 'tags',
      header: '标签',
      cell: ({ row }) => {
        const tags = row.getValue('tags') as string[]
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          更新时间
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => format(new Date(row.getValue('updatedAt')), 'yyyy-MM-dd HH:mm'),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const runbook = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(runbook)}>
                <Pencil className="mr-2 size-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => onDelete(runbook.id)}
              >
                <Trash2 className="mr-2 size-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}
