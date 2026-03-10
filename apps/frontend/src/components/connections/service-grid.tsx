import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import type { Connection } from '@chronos/shared'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ServiceCard } from './service-card'
import { ConnectionFormDialog } from './connection-form-dialog'
import { useTestConnection } from '@/lib/queries/connections'

interface ServiceGridProps {
  connections: Connection[]
}

export function ServiceGrid({ connections }: ServiceGridProps) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  const testMutation = useTestConnection()

  const filtered = useMemo(() => {
    if (!search.trim()) return connections
    const q = search.toLowerCase()
    return connections.filter(
      (c) => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q),
    )
  }, [connections, search])

  const handleEdit = (connection: Connection) => {
    setEditingConnection(connection)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingConnection(null)
    setDialogOpen(true)
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="搜索服务..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 size-4" />
          添加服务
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia>
              <Search className="size-8" />
            </EmptyMedia>
            <EmptyTitle>暂无连接</EmptyTitle>
            <EmptyDescription>
              {search ? '没有匹配的服务' : '点击"添加服务"开始配置'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((connection) => (
            <ServiceCard
              key={connection.id}
              connection={connection}
              onEdit={handleEdit}
              onTest={(id) => testMutation.mutate(id)}
              isTesting={testMutation.isPending && testMutation.variables === connection.id}
            />
          ))}
        </div>
      )}

      <ConnectionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        connection={editingConnection}
      />
    </>
  )
}
