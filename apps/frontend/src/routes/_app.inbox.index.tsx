import { useCallback, useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Inbox, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { DataTable } from '@/components/data-table/data-table'
import { incidentColumns } from '@/components/ops/incident-columns'
import { AttachmentPreview } from '@/components/ui/attachment-preview'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FileUpload, FileUploadContent, FileUploadTrigger } from '@/components/ui/file-upload'
import { PromptInput, PromptInputAction, PromptInputActions, PromptInputTextarea } from '@/components/ui/prompt-input'
import { useFileUpload } from '@/hooks/use-file-upload'
import { opsQueries, useCreateIncident } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/inbox/')({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(opsQueries.projectList()),
    context.queryClient.ensureQueryData(opsQueries.incidents({ limit: 30 })),
  ]),
  component: InboxPage,
})

function InboxPage() {
  useSuspenseQuery(opsQueries.projectList())
  const { data } = useQuery(opsQueries.incidents({ limit: 30 }))
  const incidents = data?.data ?? []

  const [open, setOpen] = useState(false)
  const createIncident = useCreateIncident()

  return (
    <div className="min-h-full bg-background px-4 py-4 md:px-8 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="flex flex-col gap-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium tracking-tight">收件箱</h1>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            新建事件
          </Button>
        </div>
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
            <PromptInputTextarea
              className="min-h-[112px]"
              placeholder="粘贴日志、告警、错误信息或截图..."
              onPaste={handlePaste}
            />
            <PromptInputActions className="justify-between px-2 pb-2">
              <PromptInputAction tooltip="上传文件">
                <FileUploadTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <Plus className="size-5" />
                  </Button>
                </FileUploadTrigger>
              </PromptInputAction>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!content.trim() || props.pending || isUploading}
              >
                创建
              </Button>
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
