import { Paperclip, FileIcon } from 'lucide-react'
import type { UseFileUploadReturn } from '@/hooks/use-file-upload'

import { Button } from '@/components/ui/button'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input'
import { FileUpload, FileUploadTrigger, FileUploadContent } from '@/components/ui/file-upload'
import { AttachmentPreview } from '@/components/ui/attachment-preview'

interface PromptInputWithUploadProps {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  fileUpload: UseFileUploadReturn
  placeholder?: string
  textareaClassName?: string
  className?: string
  wrapperClassName?: string
  renderActions: () => React.ReactNode
}

export function PromptInputWithUpload({
  value,
  onValueChange,
  onSubmit,
  disabled,
  fileUpload,
  placeholder,
  textareaClassName,
  className,
  wrapperClassName,
  renderActions,
}: PromptInputWithUploadProps) {
  return (
    <div className={wrapperClassName}>
      <FileUpload onFilesAdded={fileUpload.handleFilesAdded} disabled={disabled}>
        <FileUploadContent>
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8">
            <FileIcon className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">拖拽文件到此处上传</p>
          </div>
        </FileUploadContent>

        <PromptInput
          value={value}
          onValueChange={onValueChange}
          onSubmit={onSubmit}
          disabled={disabled}
          className={className}
        >
          {fileUpload.items.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pt-2">
              {fileUpload.items.map((item) => (
                <AttachmentPreview key={item.id} item={item} onRemove={fileUpload.removeItem} />
              ))}
            </div>
          )}

          <PromptInputTextarea
            placeholder={placeholder}
            onPaste={fileUpload.handlePaste}
            className={textareaClassName}
          />

          <PromptInputActions className="justify-between px-2 pb-1">
            <PromptInputAction tooltip="附件">
              <FileUploadTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={disabled}>
                  <Paperclip className="size-4" />
                </Button>
              </FileUploadTrigger>
            </PromptInputAction>

            {renderActions()}
          </PromptInputActions>
        </PromptInput>
      </FileUpload>
    </div>
  )
}
