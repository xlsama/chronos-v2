import type { Incident } from '@chronos/shared'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const severityConfig = {
  critical: { label: 'Critical', className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20' },
  high: { label: 'High', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20' },
  medium: { label: 'Medium', className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20' },
  low: { label: 'Low', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20' },
} as const

const statusConfig = {
  new: { label: '新建', className: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20' },
  triaging: { label: '分诊中', className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20' },
  in_progress: { label: '处理中', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  waiting_human: { label: '等待确认', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  resolved: { label: '已解决', className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20' },
  closed: { label: '已关闭', className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20' },
} as const

interface IncidentHeaderProps {
  incident: Incident
}

export function IncidentHeader({ incident }: IncidentHeaderProps) {
  const severity = severityConfig[incident.severity]
  const status = statusConfig[incident.status]

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <Button variant="ghost" size="icon-sm" asChild>
        <Link to="/inbox">
          <ArrowLeft className="size-4" />
        </Link>
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="truncate text-sm font-semibold">{incident.title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className={severity.className}>
            {severity.label}
          </Badge>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>
      </div>
    </div>
  )
}
