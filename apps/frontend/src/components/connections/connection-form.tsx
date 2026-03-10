import { useState } from 'react'
import type { ConnectionType } from '@chronos/shared'
import { useNavigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ConnectionConfigFields } from './connection-config-fields'
import {
  useCreateConnection,
  useUpdateConnection,
} from '@/lib/queries/connections'

interface ConnectionFormProps {
  mode: 'create' | 'edit'
  type: ConnectionType
  defaultValues?: {
    id: string
    name: string
    config: Record<string, string>
  }
}

export function ConnectionForm({ mode, type, defaultValues }: ConnectionFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? '')
  const [config, setConfig] = useState<Record<string, string>>(defaultValues?.config ?? {})
  const navigate = useNavigate()

  const createMutation = useCreateConnection()
  const updateMutation = useUpdateConnection()
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const data = { name: name.trim(), type, config }

    if (mode === 'edit' && defaultValues) {
      updateMutation.mutate(
        { id: defaultValues.id, data },
        { onSuccess: () => navigate({ to: '/connections' }) },
      )
    } else {
      createMutation.mutate(data, {
        onSuccess: () => navigate({ to: '/connections' }),
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">名称</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: 生产数据库"
        />
      </div>
      <Separator />
      <ConnectionConfigFields type={type} config={config} onChange={setConfig} />
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: '/connections' })}
        >
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? '保存中...' : mode === 'create' ? '创建' : '保存'}
        </Button>
      </div>
    </form>
  )
}
