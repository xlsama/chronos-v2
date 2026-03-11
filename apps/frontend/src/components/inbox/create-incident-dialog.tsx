import { useState, useCallback, useEffect } from 'react'
import { Plus, Loader2 } from 'lucide-react'

import { useCreateIncident } from '@/lib/queries/incidents'
import { useFileUpload } from '@/hooks/use-file-upload'
import { Button } from '@/components/ui/button'
import { VoiceInputButton } from '@/components/shared/voice-input-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PromptInputWithUpload } from '@/components/shared/prompt-input-with-upload'

interface CreateIncidentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateIncidentDialog({ open, onOpenChange }: CreateIncidentDialogProps) {
  const [content, setContent] = useState('')
  const fileUpload = useFileUpload()
  const createIncident = useCreateIncident()

  useEffect(() => {
    if (!open) {
      setContent('')
      fileUpload.cleanupAll()
    }
  }, [open, fileUpload.cleanupAll])

  const handleSubmit = useCallback(() => {
    if (!content.trim() || fileUpload.hasUploading || createIncident.isPending) return
    createIncident.mutate(
      {
        content: content.trim(),
        ...(fileUpload.doneAttachments.length > 0 && { attachments: fileUpload.doneAttachments }),
      },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      },
    )
  }, [content, fileUpload.hasUploading, fileUpload.doneAttachments, createIncident, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>创建事件</DialogTitle>
          <DialogDescription>输入告警内容，可附加截图或文件。创建后将自动触发 AI Agent 分析。</DialogDescription>
        </DialogHeader>

        <PromptInputWithUpload
          value={content}
          onValueChange={setContent}
          onSubmit={handleSubmit}
          disabled={createIncident.isPending}
          fileUpload={fileUpload}
          placeholder="描述告警内容..."
          textareaClassName="min-h-[120px]"
          className="rounded-2xl"
          renderActions={() => (
            <div className="flex items-center gap-1">
              <VoiceInputButton
                disabled={createIncident.isPending}
                onTranscribed={(text) => setContent((prev) => prev + text)}
              />
              <Button
                size="sm"
                disabled={!content.trim() || fileUpload.hasUploading || createIncident.isPending}
                onClick={handleSubmit}
              >
                {createIncident.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                创建
              </Button>
            </div>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}
