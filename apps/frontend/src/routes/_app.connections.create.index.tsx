import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Activity,
  ArrowLeft,
  Bell,
  Cog,
  Container,
  Database,
  Globe,
  HardDrive,
  LayoutGrid,
  Search,
  Terminal,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ServiceTypeCard } from '@/components/connections/service-type-card'
import {
  connectionTypeMetadata,
  CONNECTION_CATEGORIES,
} from '@/lib/constants/connection-types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/connections/create/')({
  component: CreateConnectionSelectPage,
})

const CATEGORY_TABS = [
  { key: null, label: '全部', icon: LayoutGrid },
  { key: '数据库', label: '数据库', icon: Database },
  { key: '缓存与消息', label: '缓存与消息', icon: HardDrive },
  { key: '容器与编排', label: '容器与编排', icon: Container },
  { key: '可观测性', label: '可观测性', icon: Activity },
  { key: '事件管理', label: '事件管理', icon: Bell },
  { key: 'API 网关', label: 'API 网关', icon: Globe },
  { key: '自动化', label: '自动化', icon: Cog },
  { key: '远程管理', label: '远程管理', icon: Terminal },
] as const

function CreateConnectionSelectPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const searchFiltered = useMemo(() => {
    if (!search.trim()) return connectionTypeMetadata
    const q = search.toLowerCase()
    return connectionTypeMetadata.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q),
    )
  }, [search])

  const categoryCounts = useMemo(() => {
    const counts = new Map<string | null, number>()
    counts.set(null, searchFiltered.length)
    for (const cat of CONNECTION_CATEGORIES) {
      counts.set(
        cat,
        searchFiltered.filter((m) => m.category === cat).length,
      )
    }
    return counts
  }, [searchFiltered])

  const filtered = useMemo(() => {
    if (!selectedCategory) return searchFiltered
    return searchFiltered.filter((m) => m.category === selectedCategory)
  }, [searchFiltered, selectedCategory])

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, typeof filtered> = {}
    for (const cat of CONNECTION_CATEGORIES) {
      const items = filtered.filter((m) => m.category === cat)
      if (items.length > 0) groups[cat] = items
    }
    return groups
  }, [filtered])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/connections">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/connections">连接管理</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>添加服务</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <div className="border-b px-6 py-6">
        <h1 className="text-2xl font-semibold">添加服务</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          选择服务类型，填写连接配置并测试连接。
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-56 shrink-0 border-r">
          <ScrollArea className="h-full">
            <div className="space-y-1 p-3">
              {CATEGORY_TABS.map((tab) => {
                const count = categoryCounts.get(tab.key) ?? 0
                const isActive = selectedCategory === tab.key
                return (
                  <button
                    key={tab.label}
                    onClick={() => setSelectedCategory(tab.key)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    )}
                  >
                    <tab.icon className="size-4 shrink-0" />
                    <span className="flex-1 text-left">{tab.label}</span>
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        isActive
                          ? 'text-accent-foreground/70'
                          : 'text-muted-foreground/70',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </nav>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <div className="relative max-w-md">
              <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                placeholder="搜索服务类型..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 pb-6">
            {filtered.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center">
                没有匹配的服务类型
              </div>
            ) : selectedCategory ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((meta) => (
                  <ServiceTypeCard key={meta.type} meta={meta} />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedByCategory).map(([category, items]) => (
                  <div key={category}>
                    <h2 className="mb-3 text-lg font-semibold">{category}</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((meta) => (
                        <ServiceTypeCard key={meta.type} meta={meta} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
