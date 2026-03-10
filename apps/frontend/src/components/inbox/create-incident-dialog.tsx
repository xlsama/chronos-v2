import { useState, useCallback, useEffect, useRef } from 'react'
import { Paperclip, Plus, X, FileIcon, Loader2 } from 'lucide-react'
import type { Attachment } from '@chronos/shared'

import { useCreateIncident } from '@/lib/queries/incidents'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input'
import { FileUpload, FileUploadTrigger, FileUploadContent } from '@/components/ui/file-upload'

type AttachmentItem =
  | { status: 'uploading'; id: string; file: File; previewUrl?: string }
  | { status: 'done'; id: string; attachment: Attachment; previewUrl?: string }
  | { status: 'error'; id: string; file: File; error: string; previewUrl?: string }

let itemIdCounter = 0

interface CreateIncidentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateIncidentDialog({ open, onOpenChange }: CreateIncidentDialogProps) {
  const [content, setContent] = useState('')
  const [items, setItems] = useState<AttachmentItem[]>([])
  const createIncident = useCreateIncident()
  const itemsRef = useRef(items)
  itemsRef.current = items

  const uploadFile = useCallback(async (file: File) => {
    const id = `att-${++itemIdCounter}`
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined

    setItems((prev) => [...prev, { status: 'uploading', id, file, previewUrl }])

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('上传失败')
      const data = (await res.json()) as { url: string; name: string; mimeType: string }
      const type = data.mimeType.startsWith('image/') ? ('image' as const) : ('file' as const)
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { status: 'done', id, attachment: { type, url: data.url, name: data.name, mimeType: data.mimeType }, previewUrl }
            : item,
        ),
      )
    } catch (err) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { status: 'error', id, file, error: err instanceof Error ? err.message : '上传失败', previewUrl }
            : item,
        ),
      )
    }
  }, [])

  const handleFilesAdded = useCallback(
    (files: File[]) => {
      for (const file of files) {
        uploadFile(file)
      }
    },
    [uploadFile],
  )

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const cleanupAll = useCallback(() => {
    for (const item of itemsRef.current) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
    setContent('')
    setItems([])
  }, [])

  useEffect(() => {
    if (!open) cleanupAll()
  }, [open, cleanupAll])

  const hasUploading = items.some((i) => i.status === 'uploading')
  const doneAttachments = items
    .filter((i): i is Extract<AttachmentItem, { status: 'done' }> => i.status === 'done')
    .map((i) => i.attachment)

  const handleSubmit = useCallback(() => {
    if (!content.trim() || hasUploading || createIncident.isPending) return
    createIncident.mutate(
      {
        content: content.trim(),
        ...(doneAttachments.length > 0 && { attachments: doneAttachments }),
      },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      },
    )
  }, [content, hasUploading, createIncident, doneAttachments, onOpenChange])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData.files)
      if (files.length > 0) {
        e.preventDefault()
        handleFilesAdded(files)
      }
    },
    [handleFilesAdded],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建事件</DialogTitle>
          <DialogDescription>输入告警内容，可附加截图或文件。创建后将自动触发 AI Agent 分析。</DialogDescription>
        </DialogHeader>

        <FileUpload onFilesAdded={handleFilesAdded}>
          <FileUploadContent>
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8">
              <FileIcon className="text-muted-foreground size-8" />
              <p className="text-muted-foreground text-sm">拖拽文件到此处上传</p>
            </div>
          </FileUploadContent>

          <PromptInput
            value={content}
            onValueChange={setContent}
            onSubmit={handleSubmit}
            disabled={createIncident.isPending}
            className="rounded-2xl"
          >
            {items.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2 pt-2">
                {items.map((item) => (
                  <AttachmentPreview key={item.id} item={item} onRemove={removeItem} />
                ))}
              </div>
            )}

            <PromptInputTextarea
              placeholder="描述告警内容..."
              onPaste={handlePaste}
            />

            <PromptInputActions className="justify-between px-2 pb-1">
              <PromptInputAction tooltip="附件">
                <FileUploadTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Paperclip className="size-4" />
                  </Button>
                </FileUploadTrigger>
              </PromptInputAction>

              <Button
                size="sm"
                disabled={!content.trim() || hasUploading || createIncident.isPending}
                onClick={handleSubmit}
              >
                {createIncident.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                创建
              </Button>
            </PromptInputActions>
          </PromptInput>
        </FileUpload>
      </DialogContent>
    </Dialog>
  )
}

function AttachmentPreview({
  item,
  onRemove,
}: {
  item: AttachmentItem
  onRemove: (id: string) => void
}) {
  const isImage =
    (item.status === 'uploading' && item.file.type.startsWith('image/')) ||
    (item.status === 'done' && item.attachment.type === 'image') ||
    (item.status === 'error' && item.file.type.startsWith('image/'))

  const name =
    item.status === 'done' ? item.attachment.name : item.file.name

  if (isImage && item.previewUrl) {
    return (
      <div className="group relative size-16 shrink-0 rounded-lg border">
        <img
          src={item.previewUrl}
          alt={name}
          className="size-full rounded-lg object-cover"
        />
        {item.status === 'uploading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="size-4 animate-spin text-white" />
          </div>
        )}
        {item.status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-500/40">
            <span className="text-[10px] font-medium text-white">失败</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="absolute -right-1 -top-1 hidden rounded-full bg-black/70 p-0.5 text-white group-hover:block"
        >
          <X className="size-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-muted flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs">
      {item.status === 'uploading' ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <FileIcon className="size-3.5" />
      )}
      <span className="max-w-[120px] truncate">{name}</span>
      {item.status === 'error' && (
        <span className="text-destructive">失败</span>
      )}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
