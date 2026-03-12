import { useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Inbox, Paperclip, Plus } from 'lucide-react'
import type { Attachment, Project } from '@chronos/shared'
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
import { opsQueries, useCreateIncident } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/inbox/')({
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(opsQueries.projectList()),
    context.queryClient.ensureQueryData(opsQueries.incidents({ limit: 30 })),
  ]),
  component: InboxPage,
})

function InboxPage() {
  const { data: projects } = useSuspenseQuery(opsQueries.projectList())
  const { data } = useQuery(opsQueries.incidents({ limit: 30 }))
  const incidents = data?.data ?? []

  const [open, setOpen] = useState(false)
  const createIncident = useCreateIncident()

  return (
    <OpsPageShell
      eyebrow="Event Trigger"
      title="Inbox is the event-driven entry point."
      description="Manual incidents and webhook-triggered events land here first. The system analyzes project ownership, retrieves context, proposes tool actions and drafts a final summary."
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" className="size-4" />
          New incident
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <OpsMetric label="Visible Incidents" value={incidents.length} />
        <OpsMetric label="Waiting Human" value={incidents.filter((incident) => incident.status === 'waiting_human').length} />
        <OpsMetric label="Resolved" value={incidents.filter((incident) => incident.status === 'resolved').length} />
      </div>

      <OpsSection title="Recent Events" description="Open any incident to review analysis, approvals, run results and the current summary draft.">
        {incidents.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No incidents yet</EmptyTitle>
              <EmptyDescription>Trigger one manually or post to `/api/webhooks/events` to exercise the new workflow.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setOpen(true)}>Create incident</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {incidents.map((incident) => (
              <Card key={incident.id} className="rounded-[1.5rem] border-border/70 bg-background/70 transition-transform hover:-translate-y-0.5">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="font-serif text-2xl tracking-tight">{incident.summary || 'Untitled incident'}</CardTitle>
                    <CardDescription className="mt-2 line-clamp-3">{incident.content}</CardDescription>
                  </div>
                  <StatusBadge value={incident.status} />
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full">{incident.source}</Badge>
                    {(incident.selectedSkills ?? []).map((skill) => (
                      <Badge key={skill} variant="outline" className="rounded-full">{skill}</Badge>
                    ))}
                    {(incident.attachments ?? []).length > 0 ? (
                      <Badge variant="outline" className="rounded-full">
                        <Paperclip className="mr-1 size-3" />
                        {incident.attachments?.length} attachments
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex justify-end">
                    <Button asChild>
                      <Link to="/inbox/$id" params={{ id: incident.id }}>Open incident</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </OpsSection>

      <IncidentDialog
        open={open}
        projects={projects}
        pending={createIncident.isPending}
        onOpenChange={setOpen}
        onSubmit={async (payload) => {
          const attachments = await uploadAttachments(payload.files)
          await createIncident.mutateAsync({
            content: payload.content,
            projectId: payload.projectId || null,
            attachments,
          })
          setOpen(false)
        }}
      />
    </OpsPageShell>
  )
}

function IncidentDialog(props: {
  open: boolean
  projects: Project[]
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { content: string; projectId?: string; files: File[] }) => Promise<void>
}) {
  const [content, setContent] = useState('')
  const [projectId, setProjectId] = useState<string | undefined>()
  const [files, setFiles] = useState<File[]>([])

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle>Create incident</DialogTitle>
          <DialogDescription>Paste logs, alerts, errors or screenshots. Project can be left empty and inferred by the analysis agent.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void props.onSubmit({ content, projectId, files })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel>Project (optional)</FieldLabel>
              <FieldContent>
                <ProjectPicker projects={props.projects} value={projectId} onValueChange={setProjectId} placeholder="Let analysis infer it" />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Incident content</FieldLabel>
              <FieldContent>
                <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={10} required />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Attachments</FieldLabel>
              <FieldContent>
                <Input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
              </FieldContent>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={props.pending}>Trigger incident</Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}

async function uploadAttachments(files: File[]): Promise<Attachment[] | undefined> {
  if (files.length === 0) return undefined
  const uploaded = await Promise.all(files.map(async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) throw new Error(`Attachment upload failed: ${res.status}`)
    const json = await res.json() as { url: string; name: string; mimeType: string }
    return {
      type: file.type.startsWith('image/') ? 'image' : 'file',
      url: json.url,
      name: json.name,
      mimeType: json.mimeType,
    } satisfies Attachment
  }))
  return uploaded
}
