import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

type MarkdownEditorPageShellProps = {
  header: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}

export function MarkdownEditorPageShell({
  header,
  children,
  className,
  headerClassName,
  contentClassName,
}: MarkdownEditorPageShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden bg-background', className)}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="flex h-full min-h-0 flex-col"
      >
        <div className={cn('shrink-0 border-b border-border/60 px-4 py-4 md:px-8 md:py-6', headerClassName)}>
          {header}
        </div>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-4 md:px-8 md:pb-6 md:pt-6',
            contentClassName,
          )}
        >
          {children}
        </div>
      </motion.div>
    </div>
  )
}
