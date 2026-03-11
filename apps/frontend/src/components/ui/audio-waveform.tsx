import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface AudioWaveformProps {
  analyser: AnalyserNode | null
  className?: string
}

export function AudioWaveform({ analyser, className }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const barsRef = useRef<number[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dataArray = analyser ? new Uint8Array(analyser.fftSize) : null

    const barWidth = 2
    const gap = 1
    const step = barWidth + gap

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Pre-fill with silence so the waveform spans the full width immediately
      const totalBars = Math.floor(width / step)
      if (barsRef.current.length === 0) {
        barsRef.current = new Array(totalBars).fill(0)
      }
    })
    ro.observe(canvas)

    const draw = () => {
      const w = canvas.width / (window.devicePixelRatio || 1)
      const h = canvas.height / (window.devicePixelRatio || 1)
      ctx.clearRect(0, 0, w, h)

      const maxBars = Math.floor(w / step) + 50

      // Calculate RMS amplitude from analyser
      let rms = 0
      if (analyser && dataArray) {
        analyser.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128
          sum += v * v
        }
        rms = Math.sqrt(sum / dataArray.length)
      }

      // Push new bar value
      barsRef.current.push(rms)
      if (barsRef.current.length > maxBars) {
        barsRef.current.shift()
      }

      // Get foreground color from CSS
      const style = getComputedStyle(canvas)
      const fg = style.getPropertyValue('--foreground').trim()

      const midY = h / 2
      const maxBarHeight = h * 0.8
      const minBarHeight = 1.5

      // Draw bars from right to left
      const bars = barsRef.current
      const totalBars = Math.floor(w / step)
      const startIndex = Math.max(0, bars.length - totalBars)

      for (let i = startIndex; i < bars.length; i++) {
        const x = w - (bars.length - i) * step
        if (x < 0) continue

        const amplitude = bars[i]
        const barHeight = Math.max(amplitude * maxBarHeight, minBarHeight)

        ctx.fillStyle = `oklch(${fg} / 0.7)`
        ctx.beginPath()
        ctx.roundRect(x, midY - barHeight / 2, barWidth, barHeight, 1)
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      barsRef.current = []
    }
  }, [analyser])

  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full', className)}
    />
  )
}
