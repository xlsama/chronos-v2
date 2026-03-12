import { useState } from 'react'
import { FileIcon } from 'lucide-react'
import type { Attachment } from '@chronos/shared'
import { AttachmentPreviewDialog, attachmentToPreviewSource } from '@/components/ui/attachment-preview-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const MAX_VISIBLE = 3

export function AttachmentThumbnails(props: { attachments: Attachment[] }) {
  const { attachments } = props
  const [preview, setPreview] = useState<Attachment | null>(null)

  if (attachments.length === 0) return null

  const visible = attachments.slice(0, MAX_VISIBLE)
  const remaining = attachments.length - MAX_VISIBLE

  return (
    <>
      <div className="flex items-center gap-1.5">
        {visible.map((att) =>
          att.type === 'image' ? (
            <button
              key={att.url}
              type="button"
              className="size-6 shrink-0 overflow-hidden rounded border"
              onClick={() => setPreview(att)}
            >
              <img src={att.url} alt={att.name} className="size-full object-cover" />
            </button>
          ) : (
            <Tooltip key={att.url}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex size-6 shrink-0 items-center justify-center rounded border text-muted-foreground hover:text-foreground"
                  onClick={() => setPreview(att)}
                >
                  <FileIcon className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{att.name}</TooltipContent>
            </Tooltip>
          ),
        )}
        {remaining > 0 && (
          <span className="text-xs text-muted-foreground">+{remaining}</span>
        )}
      </div>

      {preview ? (
        <AttachmentPreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null)
          }}
          preview={attachmentToPreviewSource(preview)}
        />
      ) : null}
    </>
  )
}
