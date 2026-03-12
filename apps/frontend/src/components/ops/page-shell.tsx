import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export function OpsPageShell(props: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(189,118,17,0.12),_transparent_42%),linear-gradient(180deg,_rgba(255,248,238,0.86),_rgba(255,255,255,1))] px-4 py-4 md:px-8 md:py-8', props.className)}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="mx-auto flex max-w-7xl flex-col gap-6"
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-[0_18px_60px_-28px_rgba(120,74,12,0.35)] backdrop-blur md:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(189,118,17,0.5),transparent)]" />
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-muted-foreground">{props.eyebrow}</p>
              <h1 className="mt-3 font-serif text-3xl tracking-tight text-foreground md:text-5xl">{props.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{props.description}</p>
            </div>
            {props.actions ? <div className="flex shrink-0 items-center gap-3">{props.actions}</div> : null}
          </div>
        </div>
        {props.children}
      </motion.div>
    </div>
  )
}

export function OpsSection(props: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[1.75rem] border border-border/80 bg-card/95 p-5 shadow-[0_12px_40px_-32px_rgba(36,22,4,0.4)] md:p-6', props.className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-serif text-xl tracking-tight text-foreground">{props.title}</h2>
          {props.description ? <p className="mt-1 text-sm text-muted-foreground">{props.description}</p> : null}
        </div>
        {props.actions ? <div className="flex items-center gap-2">{props.actions}</div> : null}
      </div>
      <div className="mt-5">{props.children}</div>
    </section>
  )
}

export function OpsMetric(props: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-[1.25rem] border border-border/70 bg-background/80 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{props.value}</div>
      {props.hint ? <div className="mt-1 text-xs text-muted-foreground">{props.hint}</div> : null}
    </div>
  )
}
