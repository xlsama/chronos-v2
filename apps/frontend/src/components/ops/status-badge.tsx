import { Badge } from '@/components/ui/badge'

const statusMap: Record<string, string> = {
  new: 'bg-slate-100 text-slate-800',
  triaging: 'bg-amber-100 text-amber-900',
  in_progress: 'bg-blue-100 text-blue-900',
  waiting_human: 'bg-rose-100 text-rose-900',
  resolved: 'bg-emerald-100 text-emerald-900',
  closed: 'bg-zinc-200 text-zinc-900',
  pending: 'bg-amber-100 text-amber-900',
  processing: 'bg-sky-100 text-sky-900',
  ready: 'bg-emerald-100 text-emerald-900',
  indexed: 'bg-sky-100 text-sky-900',
  not_indexed: 'bg-zinc-200 text-zinc-900',
  error: 'bg-rose-100 text-rose-900',
  cancelling: 'bg-orange-100 text-orange-900',
  cancelled: 'bg-zinc-200 text-zinc-900',
  active: 'bg-slate-100 text-slate-800',
  draft: 'bg-orange-100 text-orange-900',
  published: 'bg-emerald-100 text-emerald-900',
  archived: 'bg-zinc-200 text-zinc-900',
  approved: 'bg-emerald-100 text-emerald-900',
  declined: 'bg-rose-100 text-rose-900',
  expired: 'bg-zinc-200 text-zinc-900',
  connected: 'bg-emerald-100 text-emerald-900',
  disconnected: 'bg-zinc-200 text-zinc-900',
}

export function StatusBadge(props: { value: string; label?: string }) {
  return (
    <Badge className={`border-transparent capitalize ${statusMap[props.value] ?? 'bg-muted text-foreground'}`}>
      {props.label ?? props.value.replaceAll('_', ' ')}
    </Badge>
  )
}
