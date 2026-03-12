import type { Incident } from '@chronos/shared'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AttachmentThumbnails } from '@/components/ops/attachment-thumbnails'

const CONTENT_TRUNCATE_LENGTH = 80

export function AlertCell(props: { incident: Incident }) {
  const { incident } = props
  const contentPreview = incident.content.length > CONTENT_TRUNCATE_LENGTH
    ? `${incident.content.slice(0, CONTENT_TRUNCATE_LENGTH)}…`
    : incident.content

  return (
    <div className="flex min-w-[280px] max-w-[420px] flex-col gap-1 py-1">
      <span className="truncate font-medium">
        {incident.summary || 'Untitled incident'}
      </span>

      {incident.content.length > CONTENT_TRUNCATE_LENGTH ? (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="cursor-pointer truncate text-left text-xs text-muted-foreground hover:text-foreground">
              {contentPreview}
            </button>
          </PopoverTrigger>
          <PopoverContent className="max-h-80 w-96 overflow-y-auto whitespace-pre-wrap text-sm">
            {incident.content}
          </PopoverContent>
        </Popover>
      ) : (
        <span className="truncate text-xs text-muted-foreground">{incident.content}</span>
      )}

      {(incident.attachments?.length ?? 0) > 0 && (
        <AttachmentThumbnails attachments={incident.attachments!} />
      )}
    </div>
  )
}
