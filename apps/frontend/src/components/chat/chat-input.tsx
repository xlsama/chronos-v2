import { useState, useCallback, useRef } from 'react'
import { Send } from 'lucide-react'

import { useFileUpload } from '@/hooks/use-file-upload'
import { Button } from '@/components/ui/button'
import { PromptInputWithUpload } from '@/components/shared/prompt-input-with-upload'
import { KbPicker, KbBadgeList } from '@/components/shared/kb-picker'
import { useVoiceInput, VoiceInputButton, RecordingOverlay, RecordingActions } from '@/components/shared/voice-input-button'

interface ChatInputProps {
  disabled?: boolean
  onSubmit?: (text: string, knowledgeBaseIds?: string[]) => void
}

export function ChatInput({ disabled = false, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const fileUpload = useFileUpload()
  const voice = useVoiceInput((text) => setValue((prev) => prev + text))
  const isRecording = voice.recorder.state === 'recording'

  const valueRef = useRef(value)
  valueRef.current = value
  const fileUploadRef = useRef(fileUpload)
  fileUploadRef.current = fileUpload
  const selectedKbIdsRef = useRef(selectedKbIds)
  selectedKbIdsRef.current = selectedKbIds

  const handleSubmit = useCallback(() => {
    const currentValue = valueRef.current
    const fu = fileUploadRef.current
    if ((!currentValue.trim() && fu.doneAttachments.length === 0) || fu.hasUploading) return
    onSubmit?.(currentValue, selectedKbIdsRef.current.length > 0 ? selectedKbIdsRef.current : undefined)
    setValue('')
    fu.cleanupAll()
  }, [onSubmit])

  return (
    <PromptInputWithUpload
      value={value}
      onValueChange={setValue}
      onSubmit={handleSubmit}
      disabled={disabled}
      fileUpload={fileUpload}
      placeholder={disabled ? 'AI 正在自动处理中...' : '输入消息...'}
      className="mx-auto w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl"
      wrapperClassName="border-t px-4 py-3"
      renderBeforeActions={() => (
        <KbPicker selected={selectedKbIds} onChange={setSelectedKbIds} disabled={disabled || isRecording} />
      )}
      renderAboveTextarea={() => (
        <KbBadgeList selected={selectedKbIds} onChange={setSelectedKbIds} />
      )}
      isRecording={isRecording}
      renderRecordingOverlay={() => (
        <RecordingOverlay
          stream={voice.recorder.stream}
          duration={voice.recorder.duration}
        />
      )}
      renderActions={() => (
        <div className="flex items-center gap-2">
          {isRecording ? (
            <RecordingActions
              onStop={voice.handleToggle}
              onCancel={voice.handleCancel}
            />
          ) : (
            <>
              <VoiceInputButton
                disabled={disabled}
                isTranscribing={voice.isTranscribing}
                state={voice.recorder.state}
                onClick={voice.handleToggle}
              />
              <Button
                size="icon-sm"
                disabled={disabled || (!value.trim() && fileUpload.items.length === 0) || fileUpload.hasUploading}
                onClick={handleSubmit}
              >
                <Send className="size-5" />
              </Button>
            </>
          )}
        </div>
      )}
    />
  )
}
