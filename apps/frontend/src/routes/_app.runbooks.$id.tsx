import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { Save, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ops/status-badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { opsQueries, useDeleteDocument, useUpdateDocument } from '@/lib/queries/ops'

const PUBLICATION_STATUS_OPTIONS = ['draft', 'published', 'active', 'archived'] as const

export const Route = createFileRoute('/_app/runbooks/$id')({
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData(opsQueries.projectList())
    void context.queryClient.ensureQueryData(opsQueries.document(params.id))
  },
  component: RunbookDetailPage,
})

function RunbookDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: projects } = useSuspenseQuery(opsQueries.projectList())
  const { data: runbook } = useSuspenseQuery(opsQueries.document(id))

  const [title, setTitle] = useState(runbook.title)
  const [description, setDescription] = useState(runbook.description ?? '')
  const [tags, setTags] = useState(runbook.tags.join(', '))
  const [content, setContent] = useState(runbook.content ?? '')
  const [publicationStatus, setPublicationStatus] = useState<(typeof PUBLICATION_STATUS_OPTIONS)[number]>(
    normalizePublicationStatus(runbook.publicationStatus),
  )

  const updateDocument = useUpdateDocument()
  const deleteDocument = useDeleteDocument()
  const projectName = projects.find((project) => project.id === runbook.projectId)?.name ?? '项目'
  const documentTitle = title.trim() || '未命名 runbook'

  async function handleSave() {
    await updateDocument.mutateAsync({
      id,
      data: {
        title: documentTitle,
        description: description.trim() || undefined,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        content,
        publicationStatus,
      },
    })
    toast.success('runbook 已保存')
  }

  async function handleDelete() {
    if (!window.confirm(`删除「${runbook.title}」？此操作无法撤销。`)) return

    await deleteDocument.mutateAsync(id)
    toast.success('runbook 已删除')
    navigate({ to: '/runbooks' })
  }

  return (
    <div className="min-h-full bg-background px-4 py-4 md:px-8 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="flex flex-col gap-6"
      >
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/runbooks">Runbook</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{projectName}</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{documentTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <section className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={publicationStatus} label={getRunbookStatusLabel(publicationStatus)} />
                <StatusBadge value={runbook.status} label={getRunbookStatusLabel(runbook.status)} />
              </div>
              <h1 className="mt-4 text-3xl font-medium tracking-tight">{documentTitle}</h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                编辑 Markdown 内容，并在发布前先检查下方的渲染结果。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button variant="outline" onClick={() => void handleDelete()} disabled={deleteDocument.isPending}>
                <Trash2 data-icon="inline-start" className="size-4" />
                删除
              </Button>
              <Button onClick={() => void handleSave()} disabled={updateDocument.isPending || title.trim().length === 0}>
                <Save data-icon="inline-start" className="size-4" />
                保存
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_20rem]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>元数据</CardTitle>
              <CardDescription>定义这个 runbook 的命名、描述和索引信息。</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>标题</FieldLabel>
                  <FieldContent>
                    <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="runbook 标题" />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>描述</FieldLabel>
                  <FieldContent>
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                      placeholder="用于列表展示和检索上下文的简短摘要"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>标签</FieldLabel>
                  <FieldContent>
                    <Input
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="kubernetes, redis, failover"
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>发布</CardTitle>
              <CardDescription>控制可见性，并保留当前处理状态信息。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field>
                <FieldLabel>发布状态</FieldLabel>
                <FieldContent>
                  <Select value={publicationStatus} onValueChange={(value) => setPublicationStatus(value as (typeof PUBLICATION_STATUS_OPTIONS)[number])}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLICATION_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {getRunbookStatusLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm">
                <MetaRow label="项目" value={projectName} />
                <MetaRow label="来源" value={runbook.source} />
                <MetaRow label="创建时间" value={dayjs(runbook.createdAt).format('YYYY-MM-DD HH:mm')} />
                <MetaRow label="更新时间" value={dayjs(runbook.updatedAt).format('YYYY-MM-DD HH:mm')} />
                <MetaRow label="文件" value={runbook.fileName} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>编辑器</CardTitle>
            <CardDescription>使用统一的 Markdown 编辑器，保持 runbook 编写体验与产品其他区域一致。</CardDescription>
          </CardHeader>
          <CardContent>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              resetKey={id}
              minHeight={560}
              placeholder="编写 runbook 的步骤、约束、回滚说明和验证命令。"
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>预览</CardTitle>
            <CardDescription>最终阅读效果预览。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border bg-muted/20 p-5">
              {content.trim() ? (
                <Markdown className="prose prose-sm max-w-none text-sm leading-7" id={id}>
                  {content}
                </Markdown>
              ) : (
                <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed bg-background/80 px-6 text-center text-sm text-muted-foreground">
                  runbook 写入 Markdown 内容后，预览会显示在这里。
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function MetaRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{props.label}</span>
      <span className="max-w-[12rem] truncate text-right font-medium">{props.value}</span>
    </div>
  )
}

function normalizePublicationStatus(value: string) {
  return PUBLICATION_STATUS_OPTIONS.includes(value as (typeof PUBLICATION_STATUS_OPTIONS)[number])
    ? value as (typeof PUBLICATION_STATUS_OPTIONS)[number]
    : 'draft'
}

function getRunbookStatusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: '草稿',
    published: '已发布',
    active: '启用',
    archived: '已归档',
    pending: '待处理',
    processing: '处理中',
    ready: '就绪',
    indexed: '已索引',
    not_indexed: '未索引',
    error: '异常',
  }

  return labels[value] ?? value.replaceAll('_', ' ')
}
