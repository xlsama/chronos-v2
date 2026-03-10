import type { Attachment } from '@chronos/shared'
import { FileIcon, Download } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { Button } from '@/components/ui/button'

interface FilePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attachment: Attachment
}

function isMarkdown(attachment: Attachment): boolean {
  return (
    attachment.mimeType === 'text/markdown' ||
    attachment.name.endsWith('.md')
  )
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  attachment,
}: FilePreviewDialogProps) {
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !isMarkdown(attachment)) return
    setLoading(true)
    fetch(attachment.url)
      .then((res) => res.text())
      .then((text) => setMarkdownContent(text))
      .catch(() => setMarkdownContent('Failed to load file content.'))
      .finally(() => setLoading(false))
  }, [open, attachment])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="size-4" />
            {attachment.name}
          </DialogTitle>
        </DialogHeader>

        {isMarkdown(attachment) ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              markdownContent && <Markdown>{markdownContent}</Markdown>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <FileIcon className="size-12 text-muted-foreground" />
            <div className="text-center space-y-1">
              <p className="font-medium">{attachment.name}</p>
              <p className="text-sm text-muted-foreground">
                {attachment.mimeType}
              </p>
            </div>
            <Button asChild variant="outline">
              <a href={attachment.url} download={attachment.name}>
                <Download className="size-4 mr-2" />
                下载文件
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
