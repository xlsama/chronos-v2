import { useEffect, useState, type FormEvent } from 'react'
import { Save, Trash2 } from 'lucide-react'
import type { SkillRecord } from '@chronos/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Textarea } from '@/components/ui/textarea'

export type SkillEditorPayload = {
  name: string
  description?: string
  markdown: string
}

type SkillFormValues = {
  name: string
  description: string
  markdown: string
}

function buildFormValues(skill?: SkillRecord | null): SkillFormValues {
  return {
    name: skill?.name ?? '',
    description: skill?.description ?? '',
    markdown: skill?.markdown ?? '',
  }
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

  useEffect(() => {
    setValues(buildFormValues(skill))
  }, [mode, skill?.slug])

  const title = mode === 'create'
    ? '新建 Skill'
    : values.name || skill?.name || '未命名 Skill'

  const description = mode === 'create'
    ? '创建一个新的 Skill，编写 Markdown 指南。'
    : '编辑这个 Skill 的基础信息和 Markdown 指南。'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await onSubmit({
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      markdown: values.markdown,
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
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="min-h-0">
        <CardHeader>
          <CardTitle>Markdown 指南</CardTitle>
          <CardDescription>编写 Skill 的操作说明、执行原则或案例文档。</CardDescription>
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
    </form>
  )
}
