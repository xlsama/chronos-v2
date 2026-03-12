import { useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, RefreshCcw, Trash2, Waypoints } from 'lucide-react'
import type { ProjectService } from '@chronos/shared'
import { JsonBlock } from '@/components/ops/json-block'
import { OpsMetric, OpsPageShell, OpsSection } from '@/components/ops/page-shell'
import { ProjectPicker } from '@/components/ops/project-picker'
import { StatusBadge } from '@/components/ops/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { opsQueries, useCreateService, useDeleteService, useTestService, useUpdateService } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/services')({
  loader: ({ context }) => context.queryClient.ensureQueryData(opsQueries.projectList()),
  component: ServicesPage,
})

function ServicesPage() {
  const { data: projects } = useSuspenseQuery(opsQueries.projectList())
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projects[0]?.id)
  const [editing, setEditing] = useState<ProjectService | null>(null)
  const [open, setOpen] = useState(false)
  const activeProjectId = selectedProjectId ?? projects[0]?.id

  const { data: services = [] } = useQuery({
    ...opsQueries.projectServices(activeProjectId ?? ''),
    enabled: Boolean(activeProjectId),
  })
  const { data: serviceMapContext } = useQuery({
    ...opsQueries.serviceMapContext(activeProjectId ?? ''),
    enabled: Boolean(activeProjectId),
  })

  const createService = useCreateService()
  const updateService = useUpdateService()
  const deleteService = useDeleteService()
  const testService = useTestService()

  return (
    <OpsPageShell
      eyebrow="Operational Surface"
      title="Services are plain project-scoped operational entities."
      description="The frontend stays intentionally simple: each service describes one main operational endpoint. MCP remains a backend/runtime concern driven by skills, not by this form."
      actions={
        <>
          <ProjectPicker
            projects={projects}
            value={activeProjectId}
            onValueChange={setSelectedProjectId}
            placeholder="Choose project"
          />
          <Button onClick={() => { setEditing(null); setOpen(true) }} disabled={!activeProjectId}>
            <Plus data-icon="inline-start" className="size-4" />
            New service
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <OpsMetric label="Active Project" value={projects.find((project) => project.id === activeProjectId)?.name ?? 'None'} />
        <OpsMetric label="Services" value={services.length} hint="Each entry maps to one major service type." />
        <OpsMetric label="Map Nodes" value={serviceMapContext?.services?.length ?? 0} hint="Current backend placeholder context for service-map agent." />
      </div>

      <OpsSection
        title="Service Registry"
        description="Connection secrets live here; tool selection lives in skills."
      >
        {services.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Waypoints className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No services in this project</EmptyTitle>
              <EmptyDescription>Add databases, caches, observability stacks or clusters that the agent may need to reason about.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => { setEditing(null); setOpen(true) }} disabled={!activeProjectId}>Add service</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {services.map((service) => (
              <Card key={service.id} className="rounded-[1.5rem] border-border/70 bg-background/70">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="font-serif text-2xl">{service.name}</CardTitle>
                    <CardDescription className="mt-2">{service.description ?? 'No description.'}</CardDescription>
                  </div>
                  <StatusBadge value={service.status} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={service.type} />
                    {service.healthSummary ? <span className="text-sm text-muted-foreground">{service.healthSummary}</span> : null}
                  </div>
                  <JsonBlock value={service.config} />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(service); setOpen(true) }}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => testService.mutate(service.id)}>
                      <RefreshCcw data-icon="inline-start" className="size-4" />
                      Test
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteService.mutate(service.id)}>
                      <Trash2 data-icon="inline-start" className="size-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </OpsSection>

      <OpsSection title="Service Map Placeholder" description="MVP keeps service map as backend-only context. The graph below reflects the current placeholder response.">
        <JsonBlock value={serviceMapContext ?? { graph: { nodes: [], edges: [] } }} />
      </OpsSection>

      <ServiceDialog
        key={editing?.id ?? 'new'}
        open={open}
        projectId={activeProjectId}
        service={editing}
        pending={createService.isPending || updateService.isPending}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) setEditing(null)
        }}
        onSubmit={async (payload) => {
          if (!activeProjectId) return
          const parsedConfig = payload.config.trim() ? JSON.parse(payload.config) as Record<string, unknown> : {}
          if (editing) {
            await updateService.mutateAsync({
              id: editing.id,
              data: {
                name: payload.name,
                description: payload.description || undefined,
                config: parsedConfig,
              },
            })
          } else {
            await createService.mutateAsync({
              projectId: activeProjectId,
              name: payload.name,
              type: payload.type,
              description: payload.description || undefined,
              config: parsedConfig,
            })
          }
          setOpen(false)
          setEditing(null)
        }}
      />
    </OpsPageShell>
  )
}

function ServiceDialog(props: {
  open: boolean
  projectId?: string
  service: ProjectService | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { name: string; type: ProjectService['type']; description: string; config: string }) => Promise<void>
}) {
  const [name, setName] = useState(props.service?.name ?? '')
  const [type, setType] = useState<ProjectService['type']>(props.service?.type ?? 'postgresql')
  const [description, setDescription] = useState(props.service?.description ?? '')
  const [config, setConfig] = useState(JSON.stringify(props.service?.config ?? { host: '', port: 5432 }, null, 2))

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle>{props.service ? 'Edit service' : 'Create service'}</DialogTitle>
          <DialogDescription>One service equals one primary operational endpoint. Keep the shape simple and explicit.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void props.onSubmit({ name, type, description, config })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Name</FieldLabel>
              <FieldContent>
                <Input value={name} onChange={(event) => setName(event.target.value)} required />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <FieldContent>
                <Input value={type} onChange={(event) => setType(event.target.value as ProjectService['type'])} required />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldContent>
                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Config JSON</FieldLabel>
              <FieldContent>
                <Textarea value={config} onChange={(event) => setConfig(event.target.value)} rows={12} className="font-mono text-xs" />
              </FieldContent>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={props.pending}>{props.service ? 'Save service' : 'Create service'}</Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
