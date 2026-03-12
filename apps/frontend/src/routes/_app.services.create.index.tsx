import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Search } from 'lucide-react'
import type { ConnectionType } from '@chronos/shared'
import { ServiceCategorySidebar } from '@/components/ops/service-category-sidebar'
import { ServiceIcon } from '@/components/ops/service-icon'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useServicesLayout } from '@/contexts/services-layout-context'
import { SERVICE_CATEGORIES, SERVICE_TYPE_META, type ServiceCategory } from '@/lib/constants/service-types'

export const Route = createFileRoute('/_app/services/create/')({
  component: CreateServiceIndexPage,
})

function CreateServiceIndexPage() {
  const { activeProjectId } = useServicesLayout()
  const [category, setCategory] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const allTypes = Object.keys(SERVICE_TYPE_META) as ConnectionType[]

  const filtered = allTypes.filter((type) => {
    if (category) {
      const types = SERVICE_CATEGORIES[category as ServiceCategory]
      if (types && !types.includes(type)) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const meta = SERVICE_TYPE_META[type]
      return meta.label.toLowerCase().includes(q) || type.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="flex gap-6">
      <ServiceCategorySidebar value={category} onValueChange={setCategory} />
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/services">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h2 className="text-lg font-semibold">选择服务类型</h2>
          <div className="relative ml-auto max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索服务类型..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((type) => (
            <Link
              key={type}
              to="/services/create/$type"
              params={{ type }}
              search={{ project: activeProjectId }}
              className="flex flex-col items-center gap-3 rounded-lg border bg-card p-5 transition-colors hover:border-primary hover:bg-accent"
            >
              <ServiceIcon type={type} className="size-10" />
              <span className="text-sm font-medium">{SERVICE_TYPE_META[type].label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
