import { useCallback, useRef } from 'react'
import { Mic, X, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAudioRecorder, type UseAudioRecorderReturn } from '@/hooks/use-audio-recorder'
import { useAudioAnalyser } from '@/hooks/use-audio-analyser'
import { useTranscribe } from '@/lib/queries/transcribe'
import { Button } from '@/components/ui/button'
import { PromptInputAction } from '@/components/ui/prompt-input'
import { AudioWaveform } from '@/components/ui/audio-waveform'

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// --- useVoiceInput hook ---

interface UseVoiceInputReturn {
  recorder: UseAudioRecorderReturn
  isTranscribing: boolean
  handleToggle: () => void
  handleCancel: () => void
}

export function useVoiceInput(onTranscribed: (text: string) => void): UseVoiceInputReturn {
  const recorder = useAudioRecorder()
  const transcribe = useTranscribe()

  const onTranscribedRef = useRef(onTranscribed)
  onTranscribedRef.current = onTranscribed

  const handleToggle = useCallback(async () => {
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
            onTranscribedRef.current(text)
          }
        },
        onError: () => {
          toast.error('语音识别失败')
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.state, recorder.start, recorder.stop, recorder.error, transcribe.mutate])

  const handleCancel = useCallback(() => {
    recorder.cancel()
  }, [recorder.cancel])

  return {
    recorder,
    isTranscribing: transcribe.isPending,
    handleToggle,
    handleCancel,
  }
}

// --- VoiceInputButton ---

interface VoiceInputButtonProps {
  disabled?: boolean
  isTranscribing: boolean
  state: UseAudioRecorderReturn['state']
  onClick: () => void
}

export function VoiceInputButton({ disabled, isTranscribing, state, onClick }: VoiceInputButtonProps) {
  return (
    <PromptInputAction tooltip={isTranscribing ? '转录中...' : '语音输入'}>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled || isTranscribing || state === 'requesting'}
        onClick={onClick}
      >
        {isTranscribing ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Mic className="size-5" />
        )}
      </Button>
    </PromptInputAction>
  )
}

// --- RecordingOverlay ---

interface RecordingOverlayProps {
  stream: MediaStream | null
  duration: number
}

export function RecordingOverlay({ stream, duration }: RecordingOverlayProps) {
  const analyser = useAudioAnalyser(stream)

  return (
    <div className="flex items-center justify-center px-4 py-6 min-h-[44px]">
      <AudioWaveform analyser={analyser} className="h-8 flex-1" />
      <span className="ml-3 text-sm tabular-nums text-muted-foreground shrink-0">
        {formatDuration(duration)}
      </span>
    </div>
  )
}

// --- RecordingActions ---

interface RecordingActionsProps {
  onStop: () => void
  onCancel: () => void
}

export function RecordingActions({ onStop, onCancel }: RecordingActionsProps) {
  return (
    <>
      <PromptInputAction tooltip="取消">
        <Button variant="ghost" size="icon-sm" onClick={onCancel}>
          <X className="size-5" />
        </Button>
      </PromptInputAction>
      <PromptInputAction tooltip="停止录音">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onStop}
        >
          <Check className="size-5" />
        </Button>
      </PromptInputAction>
    </>
  )
}
