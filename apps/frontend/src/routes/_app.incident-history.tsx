import { useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Archive, Plus, Trash2 } from 'lucide-react'
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
import { opsQueries, useCreateMarkdownDocument, useDeleteDocument } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/incident-history')({
  loader: ({ context }) => context.queryClient.ensureQueryData(opsQueries.projectList()),
  component: IncidentHistoryPage,
})

function IncidentHistoryPage() {
  const { data: projects } = useSuspenseQuery(opsQueries.projectList())
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projects[0]?.id)
  const [open, setOpen] = useState(false)
  const activeProjectId = selectedProjectId ?? projects[0]?.id

  const { data: history = [] } = useQuery({
    ...opsQueries.projectHistory(activeProjectId ?? ''),
    enabled: Boolean(activeProjectId),
  })

  const createHistory = useCreateMarkdownDocument('incident_history')
  const deleteDocument = useDeleteDocument()

  return (
    <OpsPageShell
      eyebrow="Saved Learnings"
      title="Incident history is opt-in operational memory."
      description="Only summaries explicitly saved by an operator land here. These files back future retrieval and daily runbook synthesis."
      actions={
        <>
          <ProjectPicker projects={projects} value={activeProjectId} onValueChange={setSelectedProjectId} placeholder="Choose project" />
          <Button onClick={() => setOpen(true)} disabled={!activeProjectId}>
            <Plus data-icon="inline-start" className="size-4" />
            Add entry
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <OpsMetric label="Project" value={projects.find((project) => project.id === activeProjectId)?.name ?? 'None'} />
        <OpsMetric label="Saved Entries" value={history.length} />
        <OpsMetric label="Today" value={new Date().toLocaleDateString()} hint="Daily digest jobs summarize today's saved entries into runbook drafts." />
      </div>

      <OpsSection title="Incident History Log" description="Markdown summaries with attached metadata and retrieval-ready indexing.">
        {history.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Archive className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No saved history</EmptyTitle>
              <EmptyDescription>Save an incident summary from the inbox or create a manual note here.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setOpen(true)} disabled={!activeProjectId}>Create note</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {history.map((entry) => (
              <Card key={entry.id} className="rounded-[1.5rem] border-border/70 bg-background/70">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="font-serif text-2xl tracking-tight">{entry.title}</CardTitle>
                    <CardDescription className="mt-2">{entry.description ?? 'Saved incident summary.'}</CardDescription>
                  </div>
                  <StatusBadge value={entry.status} />
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={entry.publicationStatus} />
                    <Badge variant="outline" className="rounded-full">{entry.source}</Badge>
                    {entry.tags.map((tag) => <Badge key={tag} variant="outline" className="rounded-full">{tag}</Badge>)}
                  </div>
                  <div className="rounded-[1.25rem] border border-border/70 bg-card px-4 py-4">
                    <Markdown className="prose prose-sm max-w-none text-sm" id={entry.id}>
                      {entry.content ?? ''}
                    </Markdown>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => deleteDocument.mutate(entry.id)}>
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

      <HistoryDialog
        open={open}
        pending={createHistory.isPending}
        onOpenChange={setOpen}
        onSubmit={async (payload) => {
          if (!activeProjectId) return
          await createHistory.mutateAsync({
            projectId: activeProjectId,
            title: payload.title,
            content: payload.content,
            description: payload.description || undefined,
            tags: payload.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          })
          setOpen(false)
        }}
      />
    </OpsPageShell>
  )
}

function HistoryDialog(props: {
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { title: string; description: string; tags: string; content: string }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle>Create incident history note</DialogTitle>
          <DialogDescription>This writes a Markdown file into the project incident-history directory and indexes it for retrieval.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void props.onSubmit({ title, description, tags, content })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Title</FieldLabel>
              <FieldContent>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldContent>
                <Input value={description} onChange={(event) => setDescription(event.target.value)} />
              </FieldContent>
            </Field>
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
              <Button type="submit" disabled={props.pending}>Save note</Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
