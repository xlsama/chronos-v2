import type { ColumnDef, ColumnPinningState } from '@tanstack/react-table'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  emptyState?: ReactNode
  columnPinning?: ColumnPinningState
}

export function DataTable<TData>({ columns, data, emptyState, columnPinning }: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnPinning: columnPinning ?? { left: ['alert'], right: ['actions'] },
    },
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const pinned = header.column.getIsPinned()
              return (
                <TableHead
                  key={header.id}
                  className={cn(
                    pinned && 'sticky z-20 bg-background',
                    pinned === 'left' && 'left-0',
                    pinned === 'right' && 'right-0',
                  )}
                  style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => {
                const pinned = cell.column.getIsPinned()
                return (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      pinned && 'sticky z-10 bg-background',
                      pinned === 'left' && 'left-0',
                      pinned === 'right' && 'right-0',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center">
              {emptyState ?? 'No data.'}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
