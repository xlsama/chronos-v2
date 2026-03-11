import { X, FileIcon, Loader2 } from 'lucide-react'
import type { AttachmentItem } from '@/hooks/use-file-upload'

interface AttachmentPreviewProps {
  item: AttachmentItem
  onRemove: (id: string) => void
}

export function AttachmentPreview({ item, onRemove }: AttachmentPreviewProps) {
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
