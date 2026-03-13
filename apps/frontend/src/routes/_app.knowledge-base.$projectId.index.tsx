import { useRef, useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { ChevronDown, File, FileText, MoreHorizontal, Plus, Trash2, Upload } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ops/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { getDocumentIndexingLabel, getDocumentIndexingSummary, shouldShowDocumentIndexing } from '@/lib/document-indexing'
import { getProjectDisplayName } from '@/lib/project-display'
import { opsQueries, useCreateKnowledgeDocument, useDeleteDocument, useDeleteProject } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/knowledge-base/$projectId/')({
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData(opsQueries.projectList())
    void context.queryClient.ensureQueryData(opsQueries.projectKnowledge(params.projectId))
  },
  component: ProjectDocumentsPage,
})

function ProjectDocumentsPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { data: projects } = useSuspenseQuery(opsQueries.projectList())
  const { data: documents = [] } = useQuery({
    ...opsQueries.projectKnowledge(projectId),
    enabled: Boolean(projectId),
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const createDocument = useCreateKnowledgeDocument()
  const deleteDocument = useDeleteDocument()
  const deleteProject = useDeleteProject()

  const project = projects.find((p) => p.id === projectId)
  const projectName = getProjectDisplayName(project, '项目文档')
  const canDeleteProject = Boolean(project && project.slug !== '_global')

  async function handleFileUpload(files: FileList) {
    const promises = Array.from(files).map((file) =>
      createDocument.mutateAsync({
        projectId,
        title: file.name.replace(/\.[^.]+$/, ''),
        file,
      }),
    )
    await Promise.all(promises)
    toast.success('上传完成')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleCreateMarkdown() {
    const doc = await createDocument.mutateAsync({
      projectId,
      title: '未命名文档',
      content: '',
    })
    navigate({ to: '/knowledge-base/$projectId/$docId', params: { projectId, docId: doc.id } })
  }

  async function handleDeleteProject() {
    await deleteProject.mutateAsync(projectId)
    toast.success('知识库已删除')
    setDeleteDialogOpen(false)
    navigate({ to: '/knowledge-base', replace: true })
  }

  return (
    <>
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
                <BreadcrumbPage>{projectName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-medium tracking-tight">{projectName}</h1>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload data-icon="inline-start" className="size-4" />
                上传文档
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.xlsx,.csv,.md,.png,.jpg,.jpeg,.gif,.webp"
                onChange={(e) => {
                  if (e.target.files?.length) handleFileUpload(e.target.files)
                }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Plus data-icon="inline-start" className="size-4" />
                    新建文档
                    <ChevronDown className="size-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCreateMarkdown}>
                    <FileText className="size-4" />
                    Markdown
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canDeleteProject ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="更多操作">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={deleteProject.isPending}
                      onSelect={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="size-4" />
                      删除知识库
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>

          {documents.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <File className="size-5" />
                </EmptyMedia>
                <EmptyTitle>还没有文档</EmptyTitle>
                <EmptyDescription>上传文档或新建 Markdown 文档。</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => fileInputRef.current?.click()}>上传文档</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-3">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      {doc.source === 'markdown' ? (
                        <Link
                          to="/knowledge-base/$projectId/$docId"
                          params={{ projectId, docId: doc.id }}
                          className="block text-base font-semibold hover:underline"
                        >
                          {doc.title}
                        </Link>
                      ) : (
                        <CardTitle className="text-base">{doc.title}</CardTitle>
                      )}
                      {shouldShowDocumentIndexing(doc) ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge value={doc.status} label="Ready" />
                          <StatusBadge value={doc.indexingStatus} label={getDocumentIndexingLabel(doc)} />
                        </div>
                      ) : (
                        <StatusBadge value={doc.status} />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>{doc.description ?? doc.fileName}</span>
                        <span>{dayjs(doc.createdAt).format('YYYY-MM-DD')}</span>
                      </div>
                      {shouldShowDocumentIndexing(doc) ? (
                        <p>{getDocumentIndexingSummary(doc)}</p>
                      ) : null}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => deleteDocument.mutate(doc.id)}>
                      <Trash2 data-icon="inline-start" className="size-4" />
                      删除
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除知识库？</AlertDialogTitle>
            <AlertDialogDescription>
              {`将永久删除“${project?.name ?? '当前知识库'}”及其中所有文档。此操作不可撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProject.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteProject.isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteProject()
              }}
            >
              {deleteProject.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
