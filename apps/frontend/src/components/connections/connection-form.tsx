import { useState } from 'react'
import type { ConnectionType } from '@chronos/shared'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, TestTube } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ConnectionConfigFields } from './connection-config-fields'
import { connectionConfigFields } from '@/lib/schemas/connection'
import {
  useCreateConnection,
  useUpdateConnection,
  useTestConnectionDirect,
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
  const testMutation = useTestConnectionDirect()
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const handleTest = () => {
    testMutation.mutate(
      { type, config },
      {
        onSuccess: (data) => {
          if (data.success) {
            toast.success('连接测试成功')
          } else {
            toast.error('连接测试失败', { description: data.message })
          }
        },
        onError: (err) => {
          toast.error('连接测试失败', { description: err.message })
        },
      },
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    // In edit mode, strip empty password fields so backend preserves original values
    let submitConfig = config
    if (mode === 'edit') {
      const passwordKeys = new Set(
        (connectionConfigFields[type] ?? [])
          .filter(f => f.type === 'password')
          .map(f => f.key)
      )
      submitConfig = Object.fromEntries(
        Object.entries(config).filter(([key, value]) => !passwordKeys.has(key) || value !== '')
      )
    }

    const data = { name: name.trim(), type, config: submitConfig }

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
      <ConnectionConfigFields type={type} config={config} onChange={setConfig} mode={mode} />
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: '/connections' })}
        >
          取消
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleTest}
          disabled={testMutation.isPending}
        >
          {testMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <TestTube className="size-4" />
          )}
          测试连接
        </Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? '保存中...' : mode === 'create' ? '创建' : '保存'}
        </Button>
      </div>
    </form>
  )
}
