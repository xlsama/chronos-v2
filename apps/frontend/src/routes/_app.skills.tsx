import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { PencilLine, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { SkillRecord } from '@chronos/shared'
import { JsonBlock } from '@/components/ops/json-block'
import { OpsMetric, OpsPageShell, OpsSection } from '@/components/ops/page-shell'
import { StatusBadge } from '@/components/ops/status-badge'
import { Markdown } from '@/components/ui/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { opsQueries, useCreateSkill, useDeleteSkill, useUpdateSkill } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/skills')({
  loader: ({ context }) => context.queryClient.ensureQueryData(opsQueries.skills()),
  component: SkillsPage,
})

function SkillsPage() {
  const { data: skills } = useSuspenseQuery(opsQueries.skills())
  const createSkill = useCreateSkill()
  const updateSkill = useUpdateSkill()
  const deleteSkill = useDeleteSkill()
  const [editing, setEditing] = useState<SkillRecord | null>(null)
  const [open, setOpen] = useState(false)

  const toolCount = skills.reduce((sum, skill) => sum + skill.tools.length, 0)
  const manualCount = skills.reduce((sum, skill) => sum + skill.tools.filter((tool) => tool.approvalMode === 'manual').length, 0)

  return (
    <OpsPageShell
      eyebrow="Atomic Capabilities"
      title="Skills bind prompts, tools and approval policy."
      description="This is the backend truth source for operational capability. Tools are declared here, along with approval mode and service-type applicability."
      actions={
        <Button onClick={() => { setEditing(null); setOpen(true) }}>
          <Plus data-icon="inline-start" className="size-4" />
          New skill
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <OpsMetric label="Skills" value={skills.length} />
        <OpsMetric label="Declared Tools" value={toolCount} />
        <OpsMetric label="Manual Gates" value={manualCount} hint="Tools that pause for explicit operator approval." />
      </div>

      <OpsSection title="Skill Library" description="Filesystem-backed capabilities surfaced as editable records.">
        {skills.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sparkles className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No skills yet</EmptyTitle>
              <EmptyDescription>Create the first skill to define which tools and MCP providers a class of incidents may use.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setOpen(true)}>Create skill</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4">
            {skills.map((skill) => (
              <Card key={skill.slug} className="rounded-[1.5rem] border-border/70 bg-background/70">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="font-serif text-2xl tracking-tight">{skill.name}</CardTitle>
                    <CardDescription className="mt-2">{skill.description ?? 'No description.'}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(skill); setOpen(true) }}>
                      <PencilLine data-icon="inline-start" className="size-4" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => deleteSkill.mutate(skill.slug)}>
                      <Trash2 data-icon="inline-start" className="size-4" />
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="flex flex-wrap gap-2">
                    {skill.applicableServiceTypes.length > 0 ? skill.applicableServiceTypes.map((type) => (
                      <Badge key={type} variant="outline" className="rounded-full">{type}</Badge>
                    )) : <Badge variant="outline" className="rounded-full">global</Badge>}
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                    <div className="rounded-[1.25rem] border border-border/70 bg-card px-4 py-4">
                      <Markdown className="prose prose-sm max-w-none text-sm" id={skill.slug}>
                        {skill.markdown || 'No markdown prompt yet.'}
                      </Markdown>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="rounded-[1.25rem] border border-border/70 bg-card px-4 py-4">
                        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">MCP Servers</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {skill.mcpServers.length > 0 ? skill.mcpServers.map((server) => (
                            <Badge key={server} className="rounded-full">{server}</Badge>
                          )) : <Badge variant="outline" className="rounded-full">none</Badge>}
                        </div>
                      </div>
                      <JsonBlock value={skill.tools} />
                      <div className="flex flex-wrap gap-2">
                        {skill.tools.map((tool) => (
                          <StatusBadge key={tool.key} value={tool.approvalMode} />
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </OpsSection>

      <SkillDialog
        key={editing?.slug ?? 'new'}
        open={open}
        skill={editing}
        pending={createSkill.isPending || updateSkill.isPending}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) setEditing(null)
        }}
        onSubmit={async (payload) => {
          const config = {
            prompt: payload.prompt || undefined,
            applicableServiceTypes: payload.applicableServiceTypes.split(',').map((item) => item.trim()).filter(Boolean),
            mcpServers: payload.mcpServers.split(',').map((item) => item.trim()).filter(Boolean),
            tools: payload.toolsJson.trim() ? JSON.parse(payload.toolsJson) as SkillRecord['tools'] : [],
          }

          if (editing) {
            await updateSkill.mutateAsync({
              slug: editing.slug,
              data: {
                name: payload.name,
                description: payload.description || undefined,
                markdown: payload.markdown,
                config,
              },
            })
          } else {
            await createSkill.mutateAsync({
              name: payload.name,
              description: payload.description || undefined,
              markdown: payload.markdown,
              config,
            })
          }
          setOpen(false)
          setEditing(null)
        }}
      />
    </OpsPageShell>
  )
}

function SkillDialog(props: {
  open: boolean
  skill: SkillRecord | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: {
    name: string
    description: string
    markdown: string
    prompt: string
    applicableServiceTypes: string
    mcpServers: string
    toolsJson: string
  }) => Promise<void>
}) {
  const [name, setName] = useState(props.skill?.name ?? '')
  const [description, setDescription] = useState(props.skill?.description ?? '')
  const [markdown, setMarkdown] = useState(props.skill?.markdown ?? '')
  const [prompt, setPrompt] = useState(props.skill?.prompt ?? '')
  const [applicableServiceTypes, setApplicableServiceTypes] = useState(props.skill?.applicableServiceTypes.join(', ') ?? '')
  const [mcpServers, setMcpServers] = useState(props.skill?.mcpServers.join(', ') ?? '')
  const [toolsJson, setToolsJson] = useState(JSON.stringify(props.skill?.tools ?? [], null, 2))

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-4xl rounded-[1.75rem]">
        <DialogHeader>
          <DialogTitle>{props.skill ? 'Edit skill' : 'Create skill'}</DialogTitle>
          <DialogDescription>Keep markdown human-readable and config explicit. Approval mode belongs to the tool declarations.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void props.onSubmit({
              name,
              description,
              markdown,
              prompt,
              applicableServiceTypes,
              mcpServers,
              toolsJson,
            })
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
                <Input value={description} onChange={(event) => setDescription(event.target.value)} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Prompt</FieldLabel>
              <FieldContent>
                <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} />
              </FieldContent>
            </Field>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field>
                <FieldLabel>Applicable Service Types</FieldLabel>
                <FieldContent>
                  <Input value={applicableServiceTypes} onChange={(event) => setApplicableServiceTypes(event.target.value)} placeholder="postgresql, redis, kubernetes" />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>MCP Servers</FieldLabel>
                <FieldContent>
                  <Input value={mcpServers} onChange={(event) => setMcpServers(event.target.value)} placeholder="postgresql, prometheus" />
                </FieldContent>
              </Field>
            </div>
            <Field>
              <FieldLabel>Markdown</FieldLabel>
              <FieldContent>
                <Textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} rows={12} className="font-mono text-sm" />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Tools JSON</FieldLabel>
              <FieldContent>
                <Textarea value={toolsJson} onChange={(event) => setToolsJson(event.target.value)} rows={12} className="font-mono text-xs" />
              </FieldContent>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={props.pending}>{props.skill ? 'Save skill' : 'Create skill'}</Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
