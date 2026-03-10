import { useState, useCallback } from 'react'
import { Paperclip, Send, X, FileIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input'
import { FileUpload, FileUploadTrigger, FileUploadContent } from '@/components/ui/file-upload'

interface ChatInputProps {
  disabled?: boolean
}

export function ChatInput({ disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const handleSubmit = useCallback(() => {
    if (!value.trim() && files.length === 0) return
    // TODO: send message to backend
    setValue('')
    setFiles([])
  }, [value, files])

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="border-t px-4 py-3">
      <FileUpload onFilesAdded={handleFilesAdded} disabled={disabled}>
        <FileUploadContent>
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8">
            <FileIcon className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">拖拽文件到此处上传</p>
          </div>
        </FileUploadContent>

        <PromptInput
          value={value}
          onValueChange={setValue}
          onSubmit={handleSubmit}
          disabled={disabled}
          className="mx-auto max-w-3xl"
        >
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pt-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="bg-muted flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs"
                >
                  <FileIcon className="size-3.5" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <PromptInputTextarea placeholder={disabled ? 'AI 正在自动处理中...' : '输入消息...'} />

          <PromptInputActions className="justify-between px-2 pb-1">
            <PromptInputAction tooltip="附件">
              <FileUploadTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={disabled}>
                  <Paperclip className="size-4" />
                </Button>
              </FileUploadTrigger>
            </PromptInputAction>

            <Button
              size="icon-sm"
              disabled={disabled || (!value.trim() && files.length === 0)}
              onClick={handleSubmit}
            >
              <Send className="size-4" />
            </Button>
          </PromptInputActions>
        </PromptInput>
      </FileUpload>
    </div>
  )
}
