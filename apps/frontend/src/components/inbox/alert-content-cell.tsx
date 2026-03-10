import type { Attachment, Incident } from '@chronos/shared'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, FileIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CodeBlockCode } from '@/components/ui/code-block'
import { useTheme } from '@/contexts/theme-provider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { FilePreviewDialog } from './file-preview-dialog'

const TEXT_LIMIT = 30

export function AlertContentCell({ incident }: { incident: Incident }) {
  const { content, attachments } = incident
  const displaySource = incident.summary ?? content
  const truncated = displaySource.length > TEXT_LIMIT
  const displayText = truncated ? displaySource.slice(0, TEXT_LIMIT) + '...' : displaySource

  const images = attachments?.filter((a) => a.type === 'image') ?? []
  const files = attachments?.filter((a) => a.type === 'file') ?? []
  const hasAttachments = images.length > 0 || files.length > 0

  return (
    <div className="flex flex-col gap-1.5">
      <TextWithTooltip
        incident={incident}
        displayText={displayText}
        fullText={content}
        truncated={truncated}
      />
      {hasAttachments && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {images.length > 0 && <ImageThumbnails images={images} />}
          {files.map((file, i) => (
            <FileButton key={i} attachment={file} />
          ))}
        </div>
      )}
    </div>
  )
}

function TextWithTooltip({
  incident,
  displayText,
  fullText,
  truncated,
}: {
  incident: Incident
  displayText: string
  fullText: string
  truncated: boolean
}) {
  const showTooltip = truncated || !!incident.summary
  const [open, setOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setOpen(true), 200)
  }
  const handleLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setOpen(false), 100)
  }

  const link = (
    <Link
      to="/inbox/$id"
      params={{ id: incident.id }}
      className="font-medium hover:underline"
    >
      {displayText}
    </Link>
  )

  if (!showTooltip) return link

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={(e) => e.preventDefault()}
      >
        {link}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-80"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {incident.summary && (
          <>
            <p className="font-medium text-sm">{incident.summary}</p>
            <Separator className="my-1.5" />
          </>
        )}
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{fullText}</p>
      </PopoverContent>
    </Popover>
  )
}

function ImageThumbnails({ images }: { images: Attachment[] }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  return (
    <>
      {images.map((img, i) => (
        <img
          key={i}
          src={img.url}
          alt={img.name}
          className="size-8 rounded border object-cover cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            setIndex(i)
            setOpen(true)
          }}
        />
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-sm font-medium">
              {images[index]?.name}
              {images.length > 1 && (
                <span className="text-muted-foreground ml-2">
                  {index + 1} / {images.length}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex items-center justify-center bg-muted/30 p-4 min-h-[50vh]">
            <img
              src={images[index]?.url}
              alt={images[index]?.name}
              className="max-h-[75vh] max-w-full object-contain rounded"
            />
            {images.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full size-8"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full size-8"
                  disabled={index === images.length - 1}
                  onClick={() => setIndex((i) => i + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FileButton({ attachment }: { attachment: Attachment }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
      >
        <FileIcon className="size-3" />
        <span className="max-w-20 truncate">{attachment.name}</span>
      </button>
      <FilePreviewDialog
        open={open}
        onOpenChange={setOpen}
        attachment={attachment}
      />
    </>
  )
}
