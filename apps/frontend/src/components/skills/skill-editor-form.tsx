import { useEffect, useState, type FormEvent } from 'react'
import { Save, Trash2 } from 'lucide-react'
import type { SkillRecord } from '@chronos/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Textarea } from '@/components/ui/textarea'

export type SkillEditorPayload = {
  name: string
  description?: string
  markdown: string
  prompt?: string
  applicableServiceTypes: string[]
  mcpServers: string[]
  tools: SkillRecord['tools']
}

type SkillFormValues = {
  name: string
  description: string
  markdown: string
  prompt: string
  applicableServiceTypes: string
  mcpServers: string
  toolsJson: string
}

function buildFormValues(skill?: SkillRecord | null): SkillFormValues {
  return {
    name: skill?.name ?? '',
    description: skill?.description ?? '',
    markdown: skill?.markdown ?? '',
    prompt: skill?.prompt ?? '',
    applicableServiceTypes: skill?.applicableServiceTypes.join(', ') ?? '',
    mcpServers: skill?.mcpServers.join(', ') ?? '',
    toolsJson: JSON.stringify(skill?.tools ?? [], null, 2),
  }
}

function normalizeCommaSeparated(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

type SkillEditorFormProps = {
  mode: 'create' | 'edit'
  skill?: SkillRecord | null
  pending: boolean
  deletePending?: boolean
  onSubmit: (payload: SkillEditorPayload) => Promise<void>
  onDelete?: () => void
}

export function SkillEditorForm({
  mode,
  skill,
  pending,
  deletePending = false,
  onSubmit,
  onDelete,
}: SkillEditorFormProps) {
  const [values, setValues] = useState(() => buildFormValues(skill))
  const [toolsError, setToolsError] = useState<string | null>(null)

  useEffect(() => {
    setValues(buildFormValues(skill))
    setToolsError(null)
  }, [mode, skill?.slug])

  const title = mode === 'create'
    ? '新建 Skill'
    : values.name || skill?.name || '未命名 Skill'

  const description = mode === 'create'
    ? '创建一个新的 Skill，并配置它可使用的工具、MCP 服务与 Markdown 指南。'
    : '编辑这个 Skill 的基础信息、工具声明和 Markdown 指南。'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setToolsError(null)

    let tools: SkillRecord['tools'] = []

    try {
      const parsed = values.toolsJson.trim() ? JSON.parse(values.toolsJson) : []
      if (!Array.isArray(parsed)) {
        throw new Error('Tools JSON 必须是数组。')
      }
      tools = parsed as SkillRecord['tools']
    } catch (error) {
      setToolsError(error instanceof Error ? error.message : 'Tools JSON 格式不正确。')
      return
    }

    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      markdown: values.markdown,
      prompt: values.prompt.trim() || undefined,
      applicableServiceTypes: normalizeCommaSeparated(values.applicableServiceTypes),
      mcpServers: normalizeCommaSeparated(values.mcpServers),
      tools,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              disabled={deletePending}
              onClick={onDelete}
            >
              <Trash2 data-icon="inline-start" className="size-4" />
              删除
            </Button>
          ) : null}
          <Button type="submit" disabled={pending}>
            <Save data-icon="inline-start" className="size-4" />
            {mode === 'create' ? '创建' : '保存'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>基础信息</CardTitle>
              <CardDescription>名称和说明决定这个 Skill 在列表中的呈现方式。</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>名称</FieldLabel>
                  <FieldContent>
                    <Input
                      value={values.name}
                      onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                      placeholder="例如：Redis 故障诊断"
                      required
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>描述</FieldLabel>
                  <FieldContent>
                    <Textarea
                      value={values.description}
                      onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
                      rows={3}
                      placeholder="简要说明这个 Skill 负责什么问题场景"
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>Prompt</FieldLabel>
                  <FieldContent>
                    <Textarea
                      value={values.prompt}
                      onChange={(event) => setValues((current) => ({ ...current, prompt: event.target.value }))}
                      rows={4}
                      placeholder="可选，补充给 Agent 的系统提示词"
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>适用范围</CardTitle>
              <CardDescription>使用逗号分隔多个值，留空则视为全局可用。</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Applicable Service Types</FieldLabel>
                  <FieldContent>
                    <Input
                      value={values.applicableServiceTypes}
                      onChange={(event) => setValues((current) => ({ ...current, applicableServiceTypes: event.target.value }))}
                      placeholder="postgresql, redis, kubernetes"
                    />
                    <FieldDescription>控制这个 Skill 对哪些服务类型可见。</FieldDescription>
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>MCP Servers</FieldLabel>
                  <FieldContent>
                    <Input
                      value={values.mcpServers}
                      onChange={(event) => setValues((current) => ({ ...current, mcpServers: event.target.value }))}
                      placeholder="postgres-prod, kubernetes-core"
                    />
                    <FieldDescription>列出这个 Skill 会依赖的 MCP 服务名。</FieldDescription>
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>Markdown 指南</CardTitle>
            <CardDescription>复用通用 Markdown 编辑器来维护人类可读的 Skill 文档。</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0">
            <MarkdownEditor
              value={values.markdown}
              onChange={(markdown) => setValues((current) => ({ ...current, markdown }))}
              resetKey={skill?.slug ?? mode}
              placeholder="在这里编写 Skill 的操作说明、执行原则或案例。"
              minHeight={560}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tools JSON</CardTitle>
          <CardDescription>使用结构化 JSON 维护工具声明和审批策略。</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(toolsError)}>
              <FieldLabel>Tools</FieldLabel>
              <FieldContent>
                <Textarea
                  value={values.toolsJson}
                  onChange={(event) => {
                    setToolsError(null)
                    setValues((current) => ({ ...current, toolsJson: event.target.value }))
                  }}
                  rows={16}
                  className="font-mono text-sm"
                  spellCheck={false}
                  aria-invalid={Boolean(toolsError)}
                  placeholder='[{"key":"redis.info","toolName":"redisInfo","approvalMode":"auto","riskLevel":"low","allowedServiceTypes":["redis"]}]'
                />
                {toolsError ? <FieldError>{toolsError}</FieldError> : null}
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  )
}
