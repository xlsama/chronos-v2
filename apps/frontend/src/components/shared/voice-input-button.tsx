import { useCallback } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAudioRecorder } from '@/hooks/use-audio-recorder'
import { useTranscribe } from '@/lib/queries/transcribe'
import { Button } from '@/components/ui/button'
import { PromptInputAction } from '@/components/ui/prompt-input'

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface VoiceInputButtonProps {
  disabled?: boolean
  onTranscribed: (text: string) => void
}

export function VoiceInputButton({ disabled, onTranscribed }: VoiceInputButtonProps) {
  const recorder = useAudioRecorder()
  const transcribe = useTranscribe()
  const isTranscribing = transcribe.isPending

  const handleClick = useCallback(async () => {
    if (recorder.state === 'idle') {
      await recorder.start()
      if (recorder.error) {
        toast.error(recorder.error)
      }
    } else if (recorder.state === 'recording') {
      const blob = await recorder.stop()
      transcribe.mutate(blob, {
        onSuccess: (text) => {
          if (text.trim()) {
            onTranscribed(text)
          }
        },
        onError: () => {
          toast.error('语音识别失败')
        },
      })
    }
  }, [recorder, transcribe, onTranscribed])

  return (
    <>
      <PromptInputAction
        tooltip={recorder.state === 'recording' ? '停止录音' : '语音输入'}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={disabled || isTranscribing || recorder.state === 'requesting'}
          onClick={handleClick}
        >
          {isTranscribing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : recorder.state === 'recording' ? (
            <Square className="size-3.5 fill-current text-red-500" />
          ) : (
            <Mic className="size-4" />
          )}
        </Button>
      </PromptInputAction>
      {recorder.state === 'recording' && (
        <span className="text-xs tabular-nums text-red-500 animate-pulse">
          {formatDuration(recorder.duration)}
        </span>
      )}
    </>
  )
}
