import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { AudioWaveform } from './audio-waveform'
import type { VoiceInputState } from '@/hooks/use-voice-input'

interface VoiceRecordingOverlayProps {
  state: VoiceInputState
  duration: number
  analyser: AnalyserNode | null
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VoiceRecordingOverlay({ state, duration, analyser }: VoiceRecordingOverlayProps) {
  return (
    <AnimatePresence>
      {state !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="flex min-h-[44px] items-center gap-3 px-4 py-3"
        >
          {state === 'processing' ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">正在转写...</span>
            </div>
          ) : (
            <>
              <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                {formatDuration(duration)}
              </span>
              <AudioWaveform analyser={analyser} className="h-8 flex-1" />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
