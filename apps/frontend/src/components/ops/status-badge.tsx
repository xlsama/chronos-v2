import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export const statusLabelMap: Record<string, string> = {
  new: '新建',
  triaging: '分析中',
  in_progress: '处理中',
  waiting_human: '待人工',
  resolved: '已解决',
  closed: '已关闭',
  pending: '待处理',
  processing: '处理中',
  ready: '就绪',
  indexed: '已索引',
  not_indexed: '未索引',
  error: '错误',
  cancelling: '取消中',
  cancelled: '已取消',
  active: '活跃',
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
  approved: '已批准',
  declined: '已拒绝',
  expired: '已过期',
  connected: '已连接',
  disconnected: '未连接',
}

export const sourceLabelMap: Record<string, string> = {
  manual: '手动',
  webhook: 'Webhook',
}

const statusMap: Record<string, string> = {
  new: 'bg-slate-500/15 text-slate-400',
  triaging: 'bg-amber-500/15 text-amber-500',
  in_progress: 'bg-blue-500/15 text-blue-500',
  waiting_human: 'bg-rose-500/15 text-rose-500',
  resolved: 'bg-emerald-500/15 text-emerald-500',
  closed: 'bg-zinc-500/15 text-zinc-400',
  pending: 'bg-amber-500/15 text-amber-500',
  processing: 'bg-sky-500/15 text-sky-500',
  ready: 'bg-emerald-500/15 text-emerald-500',
  indexed: 'bg-sky-500/15 text-sky-500',
  not_indexed: 'bg-zinc-500/15 text-zinc-400',
  error: 'bg-rose-500/15 text-rose-500',
  cancelling: 'bg-orange-500/15 text-orange-500',
  cancelled: 'bg-zinc-500/15 text-zinc-400',
  active: 'bg-slate-500/15 text-slate-400',
  draft: 'bg-orange-500/15 text-orange-500',
  published: 'bg-emerald-500/15 text-emerald-500',
  archived: 'bg-zinc-500/15 text-zinc-400',
  approved: 'bg-emerald-500/15 text-emerald-500',
  declined: 'bg-rose-500/15 text-rose-500',
  expired: 'bg-zinc-500/15 text-zinc-400',
  connected: 'bg-emerald-500/15 text-emerald-500',
  disconnected: 'bg-zinc-500/15 text-zinc-400',
}

export function StatusBadge(props: { value: string; label?: string; tooltip?: string }) {
  const badge = (
    <Badge className={`border-transparent ${statusMap[props.value] ?? 'bg-muted text-foreground'}`}>
      {props.label ?? statusLabelMap[props.value] ?? props.value.replaceAll('_', ' ')}
    </Badge>
  )

  if (!props.tooltip) return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{props.tooltip}</TooltipContent>
    </Tooltip>
  )
}
