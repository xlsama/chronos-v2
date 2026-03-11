import { Paperclip, FileIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
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
  renderBeforeActions?: () => React.ReactNode
  renderAboveTextarea?: () => React.ReactNode
  isRecording?: boolean
  renderRecordingOverlay?: () => React.ReactNode
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
  renderBeforeActions,
  renderAboveTextarea,
  isRecording,
  renderRecordingOverlay,
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
          {/* textarea area — switches between normal and recording overlay */}
          <AnimatePresence mode="wait" initial={false}>
            {isRecording && renderRecordingOverlay ? (
              <motion.div
                key="recording"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {renderRecordingOverlay()}
              </motion.div>
            ) : (
              <motion.div
                key="normal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {fileUpload.items.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-2 pt-2">
                    {fileUpload.items.map((item) => (
                      <AttachmentPreview key={item.id} item={item} onRemove={fileUpload.removeItem} />
                    ))}
                  </div>
                )}

                {renderAboveTextarea?.()}

                <PromptInputTextarea
                  placeholder={placeholder}
                  onPaste={fileUpload.handlePaste}
                  className={textareaClassName}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* action bar — always visible */}
          <PromptInputActions className="justify-between px-2 pb-1">
            <div className="flex items-center gap-1">
              <PromptInputAction tooltip="附件">
                <FileUploadTrigger asChild>
                  <Button variant="ghost" size="icon-sm" disabled={disabled || isRecording}>
                    <Paperclip className="size-5" />
                  </Button>
                </FileUploadTrigger>
              </PromptInputAction>

              {renderBeforeActions?.()}
            </div>

            {renderActions()}
          </PromptInputActions>
        </PromptInput>
      </FileUpload>
    </div>
  )
}
