import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useAudioRecorder } from './use-audio-recorder'
import { useAudioAnalyser } from './use-audio-analyser'

export type VoiceInputState = 'idle' | 'recording' | 'processing'

export interface UseVoiceInputReturn {
  state: VoiceInputState
  duration: number
  analyser: AnalyserNode | null
  startRecording: () => void
  confirmRecording: () => Promise<string>
  cancelRecording: () => void
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [processingState, setProcessingState] = useState<'idle' | 'processing'>('idle')
  const recorder = useAudioRecorder()
  const analyser = useAudioAnalyser(recorder.stream)

  const state: VoiceInputState =
    processingState === 'processing'
      ? 'processing'
      : recorder.state === 'recording'
        ? 'recording'
        : 'idle'

  const startRecording = useCallback(() => {
    recorder.start()
  }, [recorder])

  const confirmRecording = useCallback(async (): Promise<string> => {
    setProcessingState('processing')
    try {
      const blob = await recorder.stop()
      const formData = new FormData()
      formData.append('file', blob, 'recording.webm')

      const res = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('转写失败')
      }

      const data = (await res.json()) as { text: string }
      return data.text
    } catch (err) {
      const message = err instanceof Error ? err.message : '语音转写失败'
      toast.error(message)
      return ''
    } finally {
      setProcessingState('idle')
    }
  }, [recorder])

  const cancelRecording = useCallback(() => {
    recorder.cancel()
    setProcessingState('idle')
  }, [recorder])

  return {
    state,
    duration: recorder.duration,
    analyser,
    startRecording,
    confirmRecording,
    cancelRecording,
  }
}
