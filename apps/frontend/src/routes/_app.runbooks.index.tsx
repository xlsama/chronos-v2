import { useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { PencilLine, Plus, ScrollText, Trash2 } from 'lucide-react'
import type { ProjectDocument } from '@chronos/shared'
import { Markdown } from '@/components/ui/markdown'
import { OpsMetric, OpsPageShell, OpsSection } from '@/components/ops/page-shell'
import { ProjectPicker } from '@/components/ops/project-picker'
import { StatusBadge } from '@/components/ops/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { opsQueries, useCreateMarkdownDocument, useDeleteDocument, useUpdateDocument } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/runbooks/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(opsQueries.projectList()),
  component: RunbooksPage,
})

function RunbooksPage() {
  const { data: projects } = useSuspenseQuery(opsQueries.projectList())
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projects[0]?.id)
  const [publicationFilter, setPublicationFilter] = useState<'draft' | 'published'>('draft')
  const [editing, setEditing] = useState<ProjectDocument | null>(null)
  const [open, setOpen] = useState(false)
  const activeProjectId = selectedProjectId ?? projects[0]?.id

  const { data: runbooks = [] } = useQuery({
    ...opsQueries.projectRunbooks(activeProjectId ?? '', publicationFilter),
    enabled: Boolean(activeProjectId),
  })

  const createRunbook = useCreateMarkdownDocument('runbook')
  const updateDocument = useUpdateDocument()
  const deleteDocument = useDeleteDocument()

  return (
    <OpsPageShell
      eyebrow="Reusable Procedure"
      title="Runbooks are Markdown files with publication state."
      description="Published runbooks feed default retrieval. Drafts are where daily learning jobs land before you review and promote them."
      actions={
        <>
          <ProjectPicker projects={projects} value={activeProjectId} onValueChange={setSelectedProjectId} placeholder="Choose project" />
          <div className="flex items-center gap-2">
            <Button variant={publicationFilter === 'draft' ? 'default' : 'outline'} onClick={() => setPublicationFilter('draft')}>Draft</Button>
            <Button variant={publicationFilter === 'published' ? 'default' : 'outline'} onClick={() => setPublicationFilter('published')}>Published</Button>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true) }} disabled={!activeProjectId}>
            <Plus data-icon="inline-start" className="size-4" />
            New runbook
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <OpsMetric label="Project" value={projects.find((project) => project.id === activeProjectId)?.name ?? 'None'} />
        <OpsMetric label="Visible Runbooks" value={runbooks.length} />
        <OpsMetric label="Filter" value={publicationFilter} hint="Published feeds main retrieval; draft stays review-only." />
      </div>

      <OpsSection title="Runbook Library" description="Procedural playbooks authored by people or synthesized from incident history.">
        {runbooks.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScrollText className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No runbooks in this state</EmptyTitle>
              <EmptyDescription>Create a manual runbook or let the daily digest job produce draft entries from saved incident history.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setOpen(true)} disabled={!activeProjectId}>Create runbook</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {runbooks.map((runbook) => (
              <Card key={runbook.id} className="rounded-[1.5rem] border-border/70 bg-background/70">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="font-serif text-2xl tracking-tight">{runbook.title}</CardTitle>
                    <CardDescription className="mt-2">{runbook.description ?? 'Markdown procedural guide.'}</CardDescription>
                  </div>
                  <StatusBadge value={runbook.publicationStatus} />
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={runbook.status} />
                    {runbook.tags.map((tag) => <Badge key={tag} variant="outline" className="rounded-full">{tag}</Badge>)}
                  </div>
                  <div className="rounded-[1.25rem] border border-border/70 bg-card px-4 py-4">
                    <Markdown className="prose prose-sm max-w-none text-sm" id={runbook.id}>
                      {runbook.content ?? ''}
                    </Markdown>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(runbook); setOpen(true) }}>
                      <PencilLine data-icon="inline-start" className="size-4" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteDocument.mutate(runbook.id)}>
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

      <RunbookDialog
        key={editing?.id ?? 'new'}
        open={open}
        runbook={editing}
        pending={createRunbook.isPending || updateDocument.isPending}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) setEditing(null)
        }}
        onSubmit={async (payload) => {
          if (!activeProjectId) return
          const data = {
            title: payload.title,
            description: payload.description || undefined,
            tags: payload.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
            content: payload.content,
            publicationStatus: payload.publicationStatus,
          }

          if (editing) {
            await updateDocument.mutateAsync({
              id: editing.id,
              data,
            })
          } else {
            await createRunbook.mutateAsync({
              projectId: activeProjectId,
              ...data,
            })
          }
          setOpen(false)
          setEditing(null)
        }}
      />
    </OpsPageShell>
  )
}

function RunbookDialog(props: {
  open: boolean
  runbook: ProjectDocument | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { title: string; description: string; tags: string; content: string; publicationStatus: 'draft' | 'published' | 'active' | 'archived' }) => Promise<void>
}) {
  const [title, setTitle] = useState(props.runbook?.title ?? '')
  const [description, setDescription] = useState(props.runbook?.description ?? '')
  const [tags, setTags] = useState(props.runbook?.tags.join(', ') ?? '')
  const [content, setContent] = useState(props.runbook?.content ?? '')
  const [publicationStatus, setPublicationStatus] = useState<'draft' | 'published' | 'active' | 'archived'>(
    (props.runbook?.publicationStatus as 'draft' | 'published' | 'active' | 'archived' | undefined) ?? 'draft',
  )

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-4xl rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle>{props.runbook ? 'Edit runbook' : 'Create runbook'}</DialogTitle>
          <DialogDescription>Runbooks remain Markdown files. Publication status controls whether they participate in default retrieval.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void props.onSubmit({ title, description, tags, content, publicationStatus })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Title</FieldLabel>
              <FieldContent>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </FieldContent>
            </Field>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field>
                <FieldLabel>Description</FieldLabel>
                <FieldContent>
                  <Input value={description} onChange={(event) => setDescription(event.target.value)} />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Publication Status</FieldLabel>
                <FieldContent>
                  <Input value={publicationStatus} onChange={(event) => setPublicationStatus(event.target.value as 'draft' | 'published' | 'active' | 'archived')} />
                </FieldContent>
              </Field>
            </div>
            <Field>
              <FieldLabel>Tags</FieldLabel>
              <FieldContent>
                <Input value={tags} onChange={(event) => setTags(event.target.value)} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Markdown</FieldLabel>
              <FieldContent>
                <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={14} className="font-mono text-sm" />
              </FieldContent>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={props.pending}>{props.runbook ? 'Save runbook' : 'Create runbook'}</Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
