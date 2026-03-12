import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, type ServiceCategory } from '@/lib/constants/service-types'
import { cn } from '@/lib/utils'

export function ServiceCategorySidebar(props: {
  value?: string
  onValueChange: (value: string | undefined) => void
}) {
  const categories = Object.keys(SERVICE_CATEGORIES) as ServiceCategory[]

  return (
    <nav className="flex w-48 shrink-0 flex-col gap-0.5">
      <button
        type="button"
        className={cn(
          'rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors',
          !props.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
        onClick={() => props.onValueChange(undefined)}
      >
        全部
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          className={cn(
            'rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors',
            props.value === cat ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )}
          onClick={() => props.onValueChange(cat)}
        >
          {SERVICE_CATEGORY_LABELS[cat]}
        </button>
      ))}
    </nav>
  )
}
