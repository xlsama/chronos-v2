import { useState, useCallback } from 'react'
import { Send } from 'lucide-react'

import { useFileUpload } from '@/hooks/use-file-upload'
import { Button } from '@/components/ui/button'
import { PromptInputWithUpload } from '@/components/shared/prompt-input-with-upload'
import { VoiceInputButton } from '@/components/shared/voice-input-button'

interface ChatInputProps {
  disabled?: boolean
}

export function ChatInput({ disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('')
  const fileUpload = useFileUpload()

  const handleSubmit = useCallback(() => {
    if ((!value.trim() && fileUpload.doneAttachments.length === 0) || fileUpload.hasUploading) return
    // TODO: send message to backend with fileUpload.doneAttachments
    setValue('')
    fileUpload.cleanupAll()
  }, [value, fileUpload])

  return (
    <PromptInputWithUpload
      value={value}
      onValueChange={setValue}
      onSubmit={handleSubmit}
      disabled={disabled}
      fileUpload={fileUpload}
      placeholder={disabled ? 'AI 正在自动处理中...' : '输入消息...'}
      className="mx-auto max-w-3xl"
      wrapperClassName="border-t px-4 py-3"
      renderActions={() => (
        <div className="flex items-center gap-1">
          <VoiceInputButton
            disabled={disabled}
            onTranscribed={(text) => setValue((prev) => prev + text)}
          />
          <Button
            size="icon-sm"
            disabled={disabled || (!value.trim() && fileUpload.items.length === 0) || fileUpload.hasUploading}
            onClick={handleSubmit}
          >
            <Send className="size-4" />
          </Button>
        </div>
      )}
    />
  )
}
