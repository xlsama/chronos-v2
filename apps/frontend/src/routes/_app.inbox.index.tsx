import { useCallback, useState } from 'react'
import type { IncidentStatus } from '@chronos/shared'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Inbox, Mic, Plus, X } from 'lucide-react'
import { motion } from 'motion/react'
import { DataTable } from '@/components/data-table/data-table'
import { incidentColumns } from '@/components/ops/incident-columns'
import { statusLabelMap } from '@/components/ops/status-badge'
import { AttachmentPreview } from '@/components/ui/attachment-preview'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FileUpload, FileUploadContent, FileUploadTrigger } from '@/components/ui/file-upload'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { PromptInput, PromptInputAction, PromptInputActions, PromptInputTextarea } from '@/components/ui/prompt-input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFileUpload } from '@/hooks/use-file-upload'
import { useVoiceInput } from '@/hooks/use-voice-input'
import { VoiceRecordingOverlay } from '@/components/ui/voice-recording-overlay'
import { opsQueries, useCreateIncident } from '@/lib/queries/ops'

const INCIDENT_STATUSES: IncidentStatus[] = ['triaging', 'in_progress', 'waiting_human', 'resolved', 'closed']

const PAGE_SIZE = 10

export const Route = createFileRoute('/_app/inbox/')({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(opsQueries.projectList()),
    context.queryClient.ensureQueryData(opsQueries.incidents({ limit: PAGE_SIZE, offset: 0 })),
  ]),
  component: InboxPage,
})

function InboxPage() {
  useSuspenseQuery(opsQueries.projectList())
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'all' | IncidentStatus>('all')
  const { data } = useQuery(opsQueries.incidents({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    ...(statusFilter !== 'all' && { status: statusFilter }),
  }))
  const incidents = data?.data ?? []
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)
  const pageItems = getPaginationItems(currentPage, totalPages)

  const [open, setOpen] = useState(false)
  const createIncident = useCreateIncident()

  return (
    <div className="flex h-full flex-col bg-background px-4 py-4 md:px-8 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="flex h-full flex-col"
      >
        <div className="mb-6 flex shrink-0 items-center justify-between">
          <h1 className="text-xl font-medium tracking-tight">收件箱</h1>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            新建事件
          </Button>
        </div>
        <Tabs
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as 'all' | IncidentStatus)
            setCurrentPage(1)
          }}
          className="mb-4 shrink-0"
        >
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            {INCIDENT_STATUSES.map((status) => (
              <TabsTrigger key={status} value={status}>
                {statusLabelMap[status]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="min-h-0 flex-1 overflow-auto">
          <DataTable
            columns={incidentColumns}
            data={incidents}
            emptyState={
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>暂无事件</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setOpen(true)}>新建事件</Button>
                </EmptyContent>
              </Empty>
            }
          />
        </div>

        <div className="shrink-0 pt-4">
          {totalPages > 1 ? (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      if (currentPage > 1) setCurrentPage((page) => page - 1)
                    }}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : undefined}
                  />
                </PaginationItem>

                {pageItems.map((item, index) => (
                  <PaginationItem key={`${item}-${index}`}>
                    {item === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href="#"
                        isActive={item === currentPage}
                        onClick={(event) => {
                          event.preventDefault()
                          setCurrentPage(item)
                        }}
                      >
                        {item}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      if (currentPage < totalPages) setCurrentPage((page) => page + 1)
                    }}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : (
            <p className="text-center text-sm text-muted-foreground">第 {currentPage} 页 / 共 {totalPages || 1} 页</p>
          )}
        </div>
      </motion.div>

      <IncidentDialog
        open={open}
        pending={createIncident.isPending}
        onOpenChange={setOpen}
        onSubmit={async (payload) => {
          await createIncident.mutateAsync({
            content: payload.content,
            attachments: payload.attachments.length > 0 ? payload.attachments : undefined,
          })
          setOpen(false)
        }}
      />
    </div>
  )
}

function IncidentDialog(props: {
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { content: string; attachments: import('@chronos/shared').Attachment[] }) => Promise<void>
}) {
  const [content, setContent] = useState('')
  const { items, addFiles, removeFile, getAttachments, reset, isUploading } = useFileUpload()
  const voice = useVoiceInput()
  const isVoiceActive = voice.state !== 'idle'

  const handleCreate = useCallback(() => {
    if (!content.trim() || isUploading) return
    void props.onSubmit({ content, attachments: getAttachments() }).then(() => {
      setContent('')
      reset()
    })
  }, [content, isUploading, props, getAttachments, reset])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.files)
      if (files.length > 0) {
        e.preventDefault()
        addFiles(files)
      }
    },
    [addFiles],
  )

  const handleVoiceConfirm = useCallback(async () => {
    const text = await voice.confirmRecording()
    if (text) setContent((prev) => (prev ? `${prev} ${text}` : text))
  }, [voice])

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建事件</DialogTitle>
        </DialogHeader>

        <FileUpload onFilesAdded={addFiles}>
          <PromptInput value={content} onValueChange={setContent} onSubmit={handleCreate}>
            {items.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2 pt-2">
                {items.map((item) => (
                  <AttachmentPreview key={item.id} item={item} onRemove={removeFile} />
                ))}
              </div>
            )}
            {isVoiceActive ? (
              <VoiceRecordingOverlay state={voice.state} duration={voice.duration} analyser={voice.analyser} />
            ) : (
              <PromptInputTextarea
                className="min-h-[112px]"
                placeholder="粘贴日志、告警、错误信息或截图..."
                onPaste={handlePaste}
              />
            )}
            <PromptInputActions className="justify-between px-2 pb-2">
              <PromptInputAction tooltip="上传文件">
                <FileUploadTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 rounded-full">
                    <Plus className="size-5" />
                  </Button>
                </FileUploadTrigger>
              </PromptInputAction>
              <div className="flex items-center gap-1">
                {isVoiceActive ? (
                  <>
                    <PromptInputAction tooltip="取消录音">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full"
                        onClick={voice.cancelRecording}
                        disabled={voice.state === 'processing'}
                      >
                        <X className="size-4" />
                      </Button>
                    </PromptInputAction>
                    <PromptInputAction tooltip="确认转写">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full"
                        onClick={handleVoiceConfirm}
                        disabled={voice.state === 'processing'}
                      >
                        <Check className="size-4" />
                      </Button>
                    </PromptInputAction>
                  </>
                ) : (
                  <>
                    <PromptInputAction tooltip="语音输入">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full"
                        onClick={voice.startRecording}
                        disabled={isUploading}
                      >
                        <Mic className="size-4" />
                      </Button>
                    </PromptInputAction>
                    <Button
                      size="sm"
                      onClick={handleCreate}
                      disabled={!content.trim() || props.pending || isUploading}
                    >
                      创建
                    </Button>
                  </>
                )}
              </div>
            </PromptInputActions>
          </PromptInput>
          <FileUploadContent>
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Plus className="size-8" />
              <p className="text-lg font-medium">拖拽文件到此处</p>
            </div>
          </FileUploadContent>
        </FileUpload>
      </DialogContent>
    </Dialog>
  )
}

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'ellipsis', totalPages] as const
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const
  }

  return [
    1,
    'ellipsis',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    'ellipsis',
    totalPages,
  ] as const
}
