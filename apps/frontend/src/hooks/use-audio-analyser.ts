import { useState, useEffect } from 'react'

export function useAudioAnalyser(stream: MediaStream | null): AnalyserNode | null {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  useEffect(() => {
    if (!stream) {
      setAnalyser(null)
      return
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const source = ctx.createMediaStreamSource(stream)
    const node = ctx.createAnalyser()
    node.fftSize = 2048
    source.connect(node)
    setAnalyser(node)

    return () => {
      source.disconnect()
      ctx.close()
      setAnalyser(null)
    }
  }, [stream])

  return analyser
}
