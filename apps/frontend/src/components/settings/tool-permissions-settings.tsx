import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toolPolicyQueries, useUpdateToolPolicy } from '@/lib/queries/tool-policies'
import type { RiskLevel } from '@chronos/shared'

const THRESHOLD_OPTIONS: { value: RiskLevel; label: string; description: string }[] = [
  { value: 'none', label: '无需审批', description: '所有操作自动执行（不推荐）' },
  { value: 'low', label: '低风险及以上', description: '仅安全只读操作自动执行' },
  { value: 'medium', label: '中风险及以上', description: '低风险写入自动执行，修改/删除需审批（推荐）' },
  { value: 'high', label: '仅高风险', description: '仅破坏性操作需审批' },
]

const TOGGLE_OPTIONS = [
  { key: 'allowDatabaseWrite' as const, label: '数据库写入', description: 'INSERT / UPDATE / DELETE 操作' },
  { key: 'allowDatabaseDDL' as const, label: '数据库 DDL', description: 'DROP / ALTER / TRUNCATE 等结构变更' },
  { key: 'allowK8sMutations' as const, label: 'Kubernetes 变更', description: 'Pod 重启、Scale、Deploy 等操作' },
  { key: 'allowSSH' as const, label: 'SSH 远程执行', description: '通过 SSH 执行远程命令' },
  { key: 'allowCICDTrigger' as const, label: 'CI/CD 触发', description: 'Jenkins / Airflow 任务触发' },
]

interface Draft {
  approvalThreshold: RiskLevel
  allowDatabaseWrite: boolean
  allowDatabaseDDL: boolean
  allowK8sMutations: boolean
  allowSSH: boolean
  allowCICDTrigger: boolean
}

export function ToolPermissionsSettings() {
  const [draft, setDraft] = useState<Draft>({
    approvalThreshold: 'medium',
    allowDatabaseWrite: true,
    allowDatabaseDDL: false,
    allowK8sMutations: true,
    allowSSH: false,
    allowCICDTrigger: true,
  })
  const [initialized, setInitialized] = useState(false)

  const { data: policy, isLoading } = useQuery(toolPolicyQueries.global())
  const updateMutation = useUpdateToolPolicy()

  useEffect(() => {
    if (policy && !initialized) {
      setDraft({
        approvalThreshold: policy.approvalThreshold,
        allowDatabaseWrite: policy.allowDatabaseWrite,
        allowDatabaseDDL: policy.allowDatabaseDDL,
        allowK8sMutations: policy.allowK8sMutations,
        allowSSH: policy.allowSSH,
        allowCICDTrigger: policy.allowCICDTrigger,
      })
      setInitialized(true)
    }
  }, [policy, initialized])

  const handleSave = () => {
    updateMutation.mutate(draft, {
      onSuccess: () => toast.success('工具权限设置已保存'),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">工具权限</h3>
        <p className="text-muted-foreground text-sm">配置 AI Agent 执行操作时的权限和审批策略</p>
      </div>
      <Separator />

      {/* Approval threshold */}
      <div className="space-y-3">
        <Label className="text-base">审批阈值</Label>
        <p className="text-muted-foreground text-sm">设置需要人工审批的最低风险等级</p>
        <RadioGroup
          value={draft.approvalThreshold}
          onValueChange={(v) => setDraft((d) => ({ ...d, approvalThreshold: v as RiskLevel }))}
          className="space-y-2"
        >
          {THRESHOLD_OPTIONS.map((opt) => (
            <div key={opt.value} className="flex items-start gap-3">
              <RadioGroupItem value={opt.value} id={`threshold-${opt.value}`} className="mt-0.5" />
              <label htmlFor={`threshold-${opt.value}`} className="cursor-pointer space-y-0.5">
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-muted-foreground text-xs">{opt.description}</div>
              </label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <Separator />

      {/* Operation type toggles */}
      <div className="space-y-3">
        <Label className="text-base">操作类型开关</Label>
        <p className="text-muted-foreground text-sm">控制 Agent 可以执行哪些类型的操作（关闭后该类操作将被完全禁止）</p>
        <div className="space-y-4 pt-1">
          {TOGGLE_OPTIONS.map((opt) => (
            <div key={opt.key} className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="font-medium">{opt.label}</Label>
                <p className="text-muted-foreground text-xs">{opt.description}</p>
              </div>
              <Switch
                checked={draft[opt.key]}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, [opt.key]: checked }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex pt-2">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="animate-spin" />}
          保存
        </Button>
      </div>
    </div>
  )
}
