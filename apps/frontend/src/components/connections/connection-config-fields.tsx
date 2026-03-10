import type { ConnectionType } from '@chronos/shared'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { connectionConfigFields } from '@/lib/schemas/connection'

interface ConnectionConfigFieldsProps {
  type: ConnectionType
  config: Record<string, string>
  onChange: (config: Record<string, string>) => void
}

export function ConnectionConfigFields({ type, config, onChange }: ConnectionConfigFieldsProps) {
  const fields = connectionConfigFields[type] ?? []

  const handleChange = (key: string, value: string) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.key} className="grid gap-1.5">
          <Label htmlFor={field.key}>{field.label}</Label>
          {field.type === 'textarea' ? (
            <Textarea
              id={field.key}
              value={config[field.key] ?? ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
          ) : (
            <Input
              id={field.key}
              type={field.type === 'password' ? 'password' : 'text'}
              value={config[field.key] ?? ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.type === 'number' ? '0' : ''}
            />
          )}
        </div>
      ))}
    </div>
  )
}
