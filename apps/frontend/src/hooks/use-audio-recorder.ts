import { useState, useRef, useCallback, useEffect } from 'react'

export type RecorderState = 'idle' | 'requesting' | 'recording'

export interface UseAudioRecorderReturn {
  state: RecorderState
  duration: number
  start: () => Promise<void>
  stop: () => Promise<Blob>
  cancel: () => void
  error: string | null
}

const MAX_DURATION = 10 * 60 // 10 minutes

function getMimeType() {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  return undefined // browser default
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveRef = useRef<((blob: Blob) => void) | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
    setDuration(0)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = getMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        resolveRef.current?.(blob)
        resolveRef.current = null
        cleanup()
        setState('idle')
      }

      recorder.start()
      setState('recording')

      let elapsed = 0
      timerRef.current = setInterval(() => {
        elapsed++
        setDuration(elapsed)
        if (elapsed >= MAX_DURATION) {
          recorder.stop()
        }
      }, 1000)
    } catch {
      cleanup()
      setState('idle')
      setError('无法访问麦克风，请检查浏览器权限')
    }
  }, [cleanup])

  const stop = useCallback(() => {
    return new Promise<Blob>((resolve) => {
      resolveRef.current = resolve
      mediaRecorderRef.current?.stop()
    })
  }, [])

  const cancel = useCallback(() => {
    resolveRef.current = null
    mediaRecorderRef.current?.stop()
    cleanup()
    setState('idle')
  }, [cleanup])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return { state, duration, start, stop, cancel, error }
}
