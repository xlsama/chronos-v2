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
    <div className={cn('min-h-full bg-background px-4 py-4 md:px-8 md:py-8', props.className)}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="mx-auto flex max-w-7xl flex-col gap-6"
      >
        <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl flex-1">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{props.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-medium tracking-tight text-foreground">{props.title}</h1>
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
    <section className={cn('rounded-xl border bg-card p-5 shadow-sm md:p-6', props.className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{props.title}</h2>
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
    <div className="rounded-lg border bg-background p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{props.value}</div>
      {props.hint ? <div className="mt-1 text-xs text-muted-foreground">{props.hint}</div> : null}
    </div>
  )
}
