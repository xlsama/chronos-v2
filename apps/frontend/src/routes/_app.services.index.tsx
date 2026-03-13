import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, RefreshCcw, Search, Trash2, Waypoints } from 'lucide-react'
import { ServiceCategorySidebar } from '@/components/ops/service-category-sidebar'
import { ServiceIcon } from '@/components/ops/service-icon'
import { StatusBadge } from '@/components/ops/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { JsonBlock } from '@/components/ops/json-block'
import { useServicesLayout } from '@/contexts/services-layout-context'
import { opsQueries, useDeleteService, useTestService } from '@/lib/queries/ops'
import { SERVICE_CATEGORIES, SERVICE_TYPE_META, type ServiceCategory } from '@/lib/constants/service-types'

export const Route = createFileRoute('/_app/services/')({
  component: ServicesIndexPage,
})

function ServicesIndexPage() {
  const { activeProjectId } = useServicesLayout()
  const [category, setCategory] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const { data: services = [] } = useQuery({
    ...opsQueries.projectServices(activeProjectId ?? ''),
    enabled: Boolean(activeProjectId),
  })

  const deleteService = useDeleteService()
  const testService = useTestService()

  const filtered = services.filter((s) => {
    if (category) {
      const types = SERVICE_CATEGORIES[category as ServiceCategory]
      if (types && !types.includes(s.type)) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="flex gap-6">
      <ServiceCategorySidebar value={category} onValueChange={setCategory} />
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索服务..."
              className="pl-9"
            />
          </div>
          <Button asChild disabled={!activeProjectId}>
            <Link to="/services/create" search={{ project: activeProjectId }}>
              <Plus data-icon="inline-start" className="size-4" />
              新建服务
            </Link>
          </Button>
        </div>

        {filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Waypoints className="size-5" />
              </EmptyMedia>
              <EmptyTitle>{services.length === 0 ? '当前项目还没有服务' : '没有匹配的服务'}</EmptyTitle>
              <EmptyDescription>
                {services.length === 0
                  ? '添加数据库、缓存、可观测平台或集群，建立项目的服务清单。'
                  : '试试调整搜索关键词或左侧分类。'}
              </EmptyDescription>
            </EmptyHeader>
            {services.length === 0 && (
              <EmptyContent>
                <Button asChild disabled={!activeProjectId}>
                  <Link to="/services/create" search={{ project: activeProjectId }}>添加服务</Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filtered.map((service) => (
              <Card key={service.id} className="h-72">
                <CardHeader className="flex flex-row items-start justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <ServiceIcon type={service.type} className="size-8" />
                    <div>
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {SERVICE_TYPE_META[service.type]?.label ?? service.type}
                        {service.description ? ` · ${service.description}` : ''}
                      </CardDescription>
                    </div>
                  </div>
                  <StatusBadge value={service.status} tooltip={service.healthSummary} />
                </CardHeader>
                <CardContent className="flex flex-col flex-1 min-h-0 gap-4">
                  <JsonBlock value={service.config} className="flex-1 min-h-0 overflow-y-auto" />
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/services/$id" params={{ id: service.id }}>
                        编辑
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => testService.mutate(service.id)}>
                      <RefreshCcw data-icon="inline-start" className="size-4" />
                      测试连接
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteService.mutate(service.id)}>
                      <Trash2 data-icon="inline-start" className="size-4" />
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
