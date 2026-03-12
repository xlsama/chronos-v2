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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { getDocumentIndexingLabel, getDocumentIndexingReasonLabel, getDocumentIndexingSummary, shouldShowDocumentIndexing } from '@/lib/document-indexing'
import { opsQueries, useDeleteDocument, useUpdateDocument } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/knowledge-base/$projectId/$docId')({
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData(opsQueries.projectList())
    void context.queryClient.ensureQueryData(opsQueries.document(params.docId))
  },
  component: DocumentEditPage,
})

function DocumentEditPage() {
  const { projectId, docId } = Route.useParams()
  const navigate = useNavigate()
  const { data: projects } = useSuspenseQuery(opsQueries.projectList())
  const { data: doc } = useSuspenseQuery(opsQueries.document(docId))

  const [title, setTitle] = useState(doc.title)
  const [content, setContent] = useState(doc.content ?? '')

  const updateDocument = useUpdateDocument()
  const deleteDocument = useDeleteDocument()
  const projectName = projects.find((project) => project.id === projectId)?.name ?? '项目文档'
  const documentTitle = title || '未命名文档'

  async function handleSave() {
    await updateDocument.mutateAsync({
      id: docId,
      data: { title, content },
    })
    toast.success('文档已保存')
  }

  async function handleDelete() {
    await deleteDocument.mutateAsync(docId)
    toast.success('文档已删除')
    navigate({ to: '/knowledge-base/$projectId', params: { projectId } })
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
                <Link to="/knowledge-base">知识库</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/knowledge-base/$projectId" params={{ projectId }}>
                  {projectName}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{documentTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-medium tracking-tight">{documentTitle}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={doc.status} label={doc.status === 'ready' ? 'Ready' : undefined} />
              {shouldShowDocumentIndexing(doc) ? (
                <StatusBadge value={doc.indexingStatus} label={getDocumentIndexingLabel(doc)} />
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDelete} disabled={deleteDocument.isPending}>
              <Trash2 data-icon="inline-start" className="size-4" />
              删除
            </Button>
            <Button onClick={handleSave} disabled={updateDocument.isPending}>
              <Save data-icon="inline-start" className="size-4" />
              保存
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>索引状态</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-muted-foreground">检索状态</p>
              <p className="font-medium">
                {shouldShowDocumentIndexing(doc)
                  ? getDocumentIndexingLabel(doc)
                  : doc.status === 'error'
                    ? '处理失败'
                    : '处理中'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">索引说明</p>
              <p className="font-medium">
                {doc.indexingStatus === 'indexed'
                  ? getDocumentIndexingSummary(doc)
                  : getDocumentIndexingReasonLabel(doc.indexingReason)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">向量块数</p>
              <p className="font-medium">{doc.vectorCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Embedding 模型</p>
              <p className="font-medium">{doc.embeddingModel ?? '未生成'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">最近索引时间</p>
              <p className="font-medium">{doc.indexedAt ? dayjs(doc.indexedAt).format('YYYY-MM-DD HH:mm:ss') : '未索引'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">文件</p>
              <p className="font-medium">{doc.fileName}</p>
            </div>
          </CardContent>
        </Card>

        <FieldGroup>
          <Field>
            <FieldLabel>标题</FieldLabel>
            <FieldContent>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="文档标题" />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>内容</FieldLabel>
            <FieldContent>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                resetKey={docId}
                placeholder="Markdown 内容"
                minHeight={560}
              />
            </FieldContent>
          </Field>
        </FieldGroup>
      </motion.div>
    </div>
  )
}
