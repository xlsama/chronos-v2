import { cn } from '@/lib/utils'
import { getServiceIconUrl, SERVICE_TYPE_META } from '@/lib/constants/service-types'

export function ServiceIcon(props: { type: string; className?: string }) {
  const url = getServiceIconUrl(props.type)
  const label = SERVICE_TYPE_META[props.type as keyof typeof SERVICE_TYPE_META]?.label ?? props.type

  if (!url) {
    return (
      <div className={cn('flex items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground', props.className)}>
        {label.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return <img src={url} alt={label} className={cn('object-contain', props.className)} />
}
