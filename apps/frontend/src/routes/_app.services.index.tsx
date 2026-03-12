import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, RefreshCcw, Search, Trash2, Waypoints } from 'lucide-react'
import type { ProjectService } from '@chronos/shared'
import { z } from 'zod'
import { ServiceCategorySidebar } from '@/components/ops/service-category-sidebar'
import { ServiceIcon } from '@/components/ops/service-icon'
import { StatusBadge } from '@/components/ops/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { JsonBlock } from '@/components/ops/json-block'
import { useServicesLayout } from '@/contexts/services-layout-context'
import { opsQueries, useDeleteService, useTestService, useUpdateService } from '@/lib/queries/ops'
import { SERVICE_CATEGORIES, SERVICE_TYPE_META, type ServiceCategory } from '@/lib/constants/service-types'

export const Route = createFileRoute('/_app/services/')({
  component: ServicesIndexPage,
})

const editServiceSchema = z.object({
  name: z.string().trim().min(1, '请输入服务名称'),
  config: z.string().trim().refine((value) => {
    if (!value) return true

    try {
      JSON.parse(value)
      return true
    } catch {
      return false
    }
  }, '请输入合法的 JSON'),
})

function ServicesIndexPage() {
  const { activeProjectId } = useServicesLayout()
  const [category, setCategory] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ProjectService | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const { data: services = [] } = useQuery({
    ...opsQueries.projectServices(activeProjectId ?? ''),
    enabled: Boolean(activeProjectId),
  })

  const deleteService = useDeleteService()
  const testService = useTestService()
  const updateService = useUpdateService()

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
              <Card key={service.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
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
                  <StatusBadge value={service.status} />
                </CardHeader>
                <CardContent className="space-y-4">
                  {service.healthSummary ? (
                    <span className="text-sm text-muted-foreground">{service.healthSummary}</span>
                  ) : null}
                  <JsonBlock value={service.config} />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(service); setEditOpen(true) }}>
                      编辑
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

      <EditServiceDialog
        key={editing?.id ?? 'edit'}
        open={editOpen}
        service={editing}
        pending={updateService.isPending}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditing(null)
        }}
        onSubmit={async (payload) => {
          if (!editing) return
          const parsedConfig = payload.config.trim() ? JSON.parse(payload.config) as Record<string, unknown> : {}
          await updateService.mutateAsync({
            id: editing.id,
            data: {
              name: payload.name,
              config: parsedConfig,
            },
          })
          setEditOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

function EditServiceDialog(props: {
  open: boolean
  service: ProjectService | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { name: string; config: string }) => Promise<void>
}) {
  const form = useForm({
    defaultValues: {
      name: props.service?.name ?? '',
      config: JSON.stringify(props.service?.config ?? {}, null, 2),
    },
    validators: { onSubmit: editServiceSchema },
    onSubmit: async ({ value }) => {
      await props.onSubmit({
        name: value.name.trim(),
        config: value.config,
      })
    },
  })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑服务</DialogTitle>
          <DialogDescription>更新服务名称和连接配置。</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>名称</FieldLabel>
                    <FieldContent>
                      <Input
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </FieldContent>
                  </Field>
                )
              }}
            />
            <form.Field
              name="config"
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel>配置 JSON</FieldLabel>
                    <FieldContent>
                      <Textarea
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid}
                        rows={12}
                        className="font-mono text-xs"
                      />
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </FieldContent>
                  </Field>
                )
              }}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>取消</Button>
              <Button type="submit" disabled={props.pending}>保存</Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
