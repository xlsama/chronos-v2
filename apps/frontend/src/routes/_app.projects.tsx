import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { PencilLine, Plus, Trash2 } from 'lucide-react'
import type { Project } from '@chronos/shared'
import { OpsMetric, OpsPageShell, OpsSection } from '@/components/ops/page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { opsQueries, useCreateProject, useDeleteProject, useUpdateProject } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/projects')({
  loader: ({ context }) => context.queryClient.ensureQueryData(opsQueries.projectList()),
  component: ProjectsPage,
})

function ProjectsPage() {
  const { data: projects } = useSuspenseQuery(opsQueries.projectList())
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const [editing, setEditing] = useState<Project | null>(null)
  const [open, setOpen] = useState(false)

  const totalDocuments = projects.reduce((sum, project) => sum + (project.documentCount ?? 0), 0)
  const totalServices = projects.reduce((sum, project) => sum + (project.serviceCount ?? 0), 0)

  const handleSubmit = async (payload: {
    name: string
    description: string
    tags: string
    contextSummary: string
  }) => {
    const data = {
      name: payload.name,
      description: payload.description || undefined,
      tags: payload.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      contextSummary: payload.contextSummary || undefined,
    }

    if (editing) {
      await updateProject.mutateAsync({ id: editing.id, data })
    } else {
      await createProject.mutateAsync(data)
    }
    setOpen(false)
    setEditing(null)
  }

  return (
    <OpsPageShell
      eyebrow="Project Registry"
      title="Projects drive the whole system."
      description="Knowledge, services, runbooks, incident history and agent routing now converge on a single project model. This page is the top of that graph."
      actions={
        <Button onClick={() => { setEditing(null); setOpen(true) }}>
          <Plus data-icon="inline-start" className="size-4" />
          New project
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <OpsMetric label="Projects" value={projects.length} hint="Top-level ownership and retrieval boundary." />
        <OpsMetric label="Documents" value={totalDocuments} hint="Knowledge + runbook + incident history assets." />
        <OpsMetric label="Services" value={totalServices} hint="Operational entities available to future tool plans." />
      </div>

      <OpsSection title="Project Catalog" description="Each project owns its files, services, vector corpus and incident learning loop.">
        {projects.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Plus className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>Create the first project before uploading knowledge or wiring services.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => { setEditing(null); setOpen(true) }}>Create project</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id} className="rounded-[1.5rem] border-border/70 bg-background/70">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="font-serif text-2xl tracking-tight">{project.name}</CardTitle>
                    <CardDescription className="mt-2">{project.description ?? 'No description yet.'}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(project); setOpen(true) }}>
                      <PencilLine data-icon="inline-start" className="size-4" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteProject.mutate(project.id)}>
                      <Trash2 data-icon="inline-start" className="size-4" />
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Slug</div>
                      <div className="mt-2 text-sm">{project.slug}</div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Footprint</div>
                      <div className="mt-2 text-sm">{project.documentCount ?? 0} docs · {project.serviceCount ?? 0} services</div>
                    </div>
                  </div>
                  {project.contextSummary ? (
                    <div className="rounded-2xl border border-border/70 bg-card px-4 py-4 text-sm leading-7 text-muted-foreground">
                      {project.contextSummary}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {project.tags.length > 0 ? project.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="rounded-full">{tag}</Badge>
                    )) : <Badge variant="outline" className="rounded-full">untagged</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </OpsSection>

      <ProjectDialog
        key={editing?.id ?? 'new'}
        open={open}
        project={editing}
        pending={createProject.isPending || updateProject.isPending}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) setEditing(null)
        }}
        onSubmit={handleSubmit}
      />
    </OpsPageShell>
  )
}

function ProjectDialog(props: {
  open: boolean
  project: Project | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { name: string; description: string; tags: string; contextSummary: string }) => Promise<void>
}) {
  const [name, setName] = useState(props.project?.name ?? '')
  const [description, setDescription] = useState(props.project?.description ?? '')
  const [tags, setTags] = useState(props.project?.tags.join(', ') ?? '')
  const [contextSummary, setContextSummary] = useState(props.project?.contextSummary ?? '')

  const resetFromProject = (project: Project | null) => {
    setName(project?.name ?? '')
    setDescription(project?.description ?? '')
    setTags(project?.tags.join(', ') ?? '')
    setContextSummary(project?.contextSummary ?? '')
  }

  return (
    <Dialog open={props.open} onOpenChange={(value) => {
      props.onOpenChange(value)
      resetFromProject(value ? props.project : null)
    }}>
      <DialogContent className="max-w-2xl rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle>{props.project ? 'Edit project' : 'Create project'}</DialogTitle>
          <DialogDescription>Define the project boundary that knowledge retrieval and incident routing should converge on.</DialogDescription>
        </DialogHeader>
        <form
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault()
            void props.onSubmit({ name, description, tags, contextSummary })
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
              <FieldLabel>Description</FieldLabel>
              <FieldContent>
                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Tags</FieldLabel>
              <FieldContent>
                <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="payments, k8s, customer-facing" />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Context Summary</FieldLabel>
              <FieldContent>
                <Textarea value={contextSummary} onChange={(event) => setContextSummary(event.target.value)} rows={6} />
              </FieldContent>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={props.pending}>{props.project ? 'Save changes' : 'Create project'}</Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
