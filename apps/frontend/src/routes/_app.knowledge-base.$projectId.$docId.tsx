import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownEditorPageShell } from '@/components/ops/markdown-editor-page-shell'
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
import { Card, CardContent } from '@/components/ui/card'
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
    <MarkdownEditorPageShell
      header={
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
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

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={doc.status} label={doc.status === 'ready' ? 'Ready' : undefined} />
                {shouldShowDocumentIndexing(doc) ? (
                  <StatusBadge value={doc.indexingStatus} label={getDocumentIndexingLabel(doc)} />
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                标题
              </p>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="文档标题"
                className="h-auto border-0 bg-transparent dark:bg-transparent px-0 text-2xl font-medium tracking-tight shadow-none focus-visible:ring-0"
              />
            </div>

            <Card>
              <CardContent className="grid gap-4 p-4 text-sm sm:grid-cols-2">
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
                  <p className="font-medium">
                    {doc.indexedAt ? dayjs(doc.indexedAt).format('YYYY-MM-DD HH:mm:ss') : '未索引'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">文件</p>
                  <p className="font-medium">{doc.fileName}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <MarkdownEditor
        value={content}
        onChange={setContent}
        resetKey={docId}
        placeholder="Markdown 内容"
        fullHeight
        className="flex-1"
      />
    </MarkdownEditorPageShell>
  )
}
