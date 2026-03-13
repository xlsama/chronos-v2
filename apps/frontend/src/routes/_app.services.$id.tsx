import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { RefreshCcw, Save, Trash2 } from 'lucide-react'
import type { ConnectionType } from '@chronos/shared'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { ServiceIcon } from '@/components/ops/service-icon'
import { StatusBadge } from '@/components/ops/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SERVICE_TYPE_META } from '@/lib/constants/service-types'
import { opsQueries, useDeleteService, useTestService, useUpdateService } from '@/lib/queries/ops'
import {
  buildConnectionConfig,
  connectionConfigFields,
  createConnectionFormSchema,
  parseConnectionConfig,
  type ConnectionFormValues,
} from '@/lib/schemas/connection'

export const Route = createFileRoute('/_app/services/$id')({
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData(opsQueries.service(params.id))
  },
  component: ServiceDetailPage,
})

function ServiceDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: service } = useSuspenseQuery(opsQueries.service(id))

  const connectionType = service.type as ConnectionType
  const meta = SERVICE_TYPE_META[connectionType]
  const fields = connectionConfigFields[connectionType] ?? []

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const updateService = useUpdateService()
  const deleteService = useDeleteService()
  const testService = useTestService()

  const form = useForm<ConnectionFormValues>({
    defaultValues: {
      ...parseConnectionConfig(service.config as Record<string, unknown>, connectionType),
      name: service.name,
    },
    validators: { onSubmit: createConnectionFormSchema(connectionType) },
    onSubmit: async ({ value }) => {
      await updateService.mutateAsync({
        id: service.id,
        data: {
          name: value.name.trim(),
          config: buildConnectionConfig(value, connectionType),
        },
      })
      toast.success('服务已保存')
    },
  })

  async function handleDelete() {
    await deleteService.mutateAsync(service.id)
    setDeleteDialogOpen(false)
    toast.success('服务已删除')
    navigate({ to: '/services' })
  }

  function handleTest() {
    testService.mutate(service.id, {
      onSuccess: () => toast.success('连接测试成功'),
      onError: (error) => toast.error(`连接测试失败: ${error.message}`),
    })
  }

  return (
    <>
      <div className="flex flex-col gap-6 pb-14 md:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          className="flex flex-col gap-6"
        >
          <div className="flex items-center justify-between">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/services">服务</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{service.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-2">
              <StatusBadge value={service.status} tooltip={service.healthSummary} />
              <Button
                variant="outline"
                size="sm"
                disabled={testService.isPending}
                onClick={handleTest}
              >
                <RefreshCcw data-icon="inline-start" className="size-4" />
                测试连接
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={deleteService.isPending}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 data-icon="inline-start" className="size-4" />
                删除
              </Button>
              <Button
                size="sm"
                disabled={updateService.isPending}
                onClick={() => form.handleSubmit()}
              >
                <Save data-icon="inline-start" className="size-4" />
                保存
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ServiceIcon type={connectionType} className="size-8" />
            <form.Field
              name="name"
              children={(field) => (
                <Input
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="服务名称"
                  className="h-auto max-w-sm border-0 bg-transparent dark:bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
                />
              )}
            />
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {meta?.label ?? connectionType}
            </span>
          </div>

          {fields.length > 0 && (
            <Card className="w-full max-w-3xl">
              <CardContent className="pt-6">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    form.handleSubmit()
                  }}
                >
                  <FieldGroup>
                    {fields.map((configField) => (
                      <form.Field
                        key={configField.key}
                        name={configField.key as keyof ConnectionFormValues}
                        children={(field) => {
                          const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

                          return (
                            <Field data-invalid={isInvalid}>
                              <FieldLabel>{configField.label}</FieldLabel>
                              <FieldContent>
                                {configField.type === 'textarea' ? (
                                  <Textarea
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                    aria-invalid={isInvalid}
                                    placeholder={configField.placeholder}
                                    rows={4}
                                    className="font-mono text-xs"
                                  />
                                ) : (
                                  <Input
                                    type={configField.type === 'password' ? 'password' : configField.type}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(event) => field.handleChange(event.target.value)}
                                    aria-invalid={isInvalid}
                                    placeholder={configField.placeholder}
                                  />
                                )}
                                {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                              </FieldContent>
                            </Field>
                          )
                        }}
                      />
                    ))}
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除服务？</AlertDialogTitle>
            <AlertDialogDescription>
              删除「{service.name}」后将无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteService.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteService.isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {deleteService.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
