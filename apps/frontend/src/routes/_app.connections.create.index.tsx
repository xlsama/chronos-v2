import { useMemo, useState, type ReactNode } from 'react'
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
  Library,
  Search,
  Sparkles,
  Terminal,
} from 'lucide-react'

import { ConnectionImportDialog } from '@/components/connections/connection-import-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">添加服务</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            可以手动逐个创建，也可以让系统从知识库文档里自动识别并批量导入。
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="relative overflow-hidden border-slate-200 py-0">
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-slate-100/80 to-transparent" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="size-5 text-slate-700" />
                手动创建
              </CardTitle>
              <CardDescription>
                适合单个连接的精确配置。先选择服务类型，再填写表单并测试连接。
              </CardDescription>
            </CardHeader>
            <CardContent className="relative flex items-center justify-between gap-4 pb-6">
              <div className="text-muted-foreground text-sm">
                保留现有流程，适合你已经知道要连哪种服务的情况。
              </div>
              <BadgeLike>逐个配置</BadgeLike>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 via-background to-orange-50 py-0">
            <div className="absolute -right-8 -top-8 size-28 rounded-full bg-amber-200/35 blur-2xl" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2">
                <Library className="size-5 text-amber-600" />
                从知识库导入
              </CardTitle>
              <CardDescription>
                选择一个知识库项目，AI 会分析文档中的服务、账号、主机和密码等信息，生成待导入列表。
              </CardDescription>
            </CardHeader>
            <CardContent className="relative flex items-center justify-between gap-4 pb-6">
              <div className="text-muted-foreground text-sm">
                先 review 候选，再一键批量导入，避免重复手动填写。
              </div>
              <ConnectionImportDialog
                navigateToConnectionsOnSuccess
                trigger={(
                  <Button>
                    <Sparkles className="size-4" />
                    从知识库导入
                  </Button>
                )}
              />
            </CardContent>
          </Card>
        </div>
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
            <div className="mb-4">
              <div className="text-sm font-medium">手动选择服务类型</div>
              <p className="text-muted-foreground mt-1 text-sm">
                从下面的类型库里选择一个服务，进入单连接创建表单。
              </p>
            </div>
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

function BadgeLike({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs font-medium">
      {children}
    </span>
  )
}
