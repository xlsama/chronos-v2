import { useEffect, useState } from 'react'
import type { Connection, ConnectionType } from '@chronos/shared'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ConnectionConfigFields } from './connection-config-fields'
import { serviceTypeConfig } from './service-card'
import {
  useCreateConnection,
  useUpdateConnection,
} from '@/lib/queries/connections'

const connectionTypes: ConnectionType[] = [
  'mysql',
  'postgresql',
  'redis',
  'grafana',
  'elasticsearch',
  'kubernetes',
  'prometheus',
]

interface ConnectionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connection?: Connection | null
}

export function ConnectionFormDialog({
  open,
  onOpenChange,
  connection,
}: ConnectionFormDialogProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ConnectionType>('mysql')
  const [config, setConfig] = useState<Record<string, string>>({})

  const createMutation = useCreateConnection()
  const updateMutation = useUpdateConnection()
  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const isEdit = !!connection

  useEffect(() => {
    if (connection) {
      setName(connection.name)
      setType(connection.type)
      try {
        setConfig(JSON.parse(connection.config))
      } catch {
        setConfig({})
      }
    } else {
      setName('')
      setType('mysql')
      setConfig({})
    }
  }, [connection, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const data = { name: name.trim(), type, config }

    if (isEdit && connection) {
      updateMutation.mutate(
        { id: connection.id, data },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      createMutation.mutate(data, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑连接' : '添加连接'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 生产数据库"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>类型</Label>
            <Select value={type} onValueChange={(v) => { setType(v as ConnectionType); setConfig({}) }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {connectionTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {serviceTypeConfig[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <ConnectionConfigFields type={type} config={config} onChange={setConfig} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
