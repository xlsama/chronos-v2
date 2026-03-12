import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Clock3, MessageSquare, Save, X } from 'lucide-react'
import { useState } from 'react'
import { ChatPanel } from '@/components/chat/chat-panel'
import { JsonBlock } from '@/components/ops/json-block'
import { OpsMetric, OpsPageShell, OpsSection } from '@/components/ops/page-shell'
import { StatusBadge } from '@/components/ops/status-badge'
import { Markdown } from '@/components/ui/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { opsQueries, useDecideApproval, useSaveIncidentSummary } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/inbox/$id')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opsQueries.incidentDetail(params.id)),
  component: IncidentDetailPage,
})

function IncidentDetailPage() {
  const { id } = Route.useParams()
  const { data: incident } = useSuspenseQuery(opsQueries.incidentDetail(id))
  const saveSummary = useSaveIncidentSummary()
  const decideApproval = useDecideApproval()
  const [showChat, setShowChat] = useState(false)

  const threadId = incident.threadId ?? `incident-${incident.id}`

  return (
    <OpsPageShell
      eyebrow="Incident Workspace"
      title={incident.summary || 'Incident investigation'}
      description={incident.content}
      actions={
        <>
          <StatusBadge value={incident.status} />
          <Button variant="outline" onClick={() => setShowChat(!showChat)}>
            <MessageSquare data-icon="inline-start" className="size-4" />
            {showChat ? '隐藏对话' : 'Agent 对话'}
          </Button>
          {incident.finalSummaryDraft ? (
            <Button onClick={() => saveSummary.mutate(incident.id)} disabled={saveSummary.isPending || incident.status === 'resolved'}>
              <Save data-icon="inline-start" className="size-4" />
              Save to history
            </Button>
          ) : null}
        </>
      }
    >
      <div className={`grid gap-4 ${showChat ? 'xl:grid-cols-[1fr_1fr]' : 'xl:grid-cols-[1.35fr_0.95fr]'}`}>
        {/* Left column: Summary + Approvals OR Chat */}
        <div className="flex flex-col gap-4">
          {showChat ? (
            <OpsSection title="Agent 对话" description="与 Agent 实时对话，分析和解决事件">
              <div className="h-[600px] rounded-[1.25rem] border border-border/70 bg-background/70 overflow-hidden">
                <ChatPanel threadId={threadId} incidentId={incident.id} />
              </div>
            </OpsSection>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <OpsMetric label="Project" value={incident.project?.name ?? 'Unresolved'} />
                <OpsMetric label="Approvals" value={incident.approvalCount} />
                <OpsMetric label="Runs" value={incident.runs.length} hint="Each incident may accumulate multiple workflow runs over time." />
              </div>

              <OpsSection title="Final Summary Draft" description="This Markdown is what can be persisted into incident history after you review it.">
                <div className="rounded-[1.25rem] border border-border/70 bg-background/70 px-5 py-5">
                  <Markdown className="prose prose-sm max-w-none text-sm" id={incident.id}>
                    {incident.finalSummaryDraft ?? 'No summary draft yet.'}
                  </Markdown>
                </div>
              </OpsSection>

              <OpsSection title="Approvals" description="Skill-defined manual tool gates stop the workflow here until an operator decides.">
                {incident.approvals.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No pending or historical approvals for this incident.</div>
                ) : (
                  <div className="grid gap-4">
                    {incident.approvals.map((approval) => (
                      <Card key={approval.id} className="rounded-[1.25rem] border-border/70 bg-background/70">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-lg">{approval.toolName}</CardTitle>
                            <CardDescription className="mt-2">{approval.description ?? approval.skillSlug}</CardDescription>
                          </div>
                          <StatusBadge value={approval.status} />
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full">{approval.skillSlug}</Badge>
                            <Badge variant="outline" className="rounded-full">{approval.serviceName ?? 'generic'}</Badge>
                            <Badge variant="outline" className="rounded-full">{approval.riskLevel}</Badge>
                          </div>
                          <JsonBlock value={approval.input} />
                          {approval.status === 'pending' ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => decideApproval.mutate({ incidentId: incident.id, approvalId: approval.id, approved: true })}
                              >
                                <Check data-icon="inline-start" className="size-4" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => decideApproval.mutate({ incidentId: incident.id, approvalId: approval.id, approved: false })}
                              >
                                <X data-icon="inline-start" className="size-4" />
                                Decline
                              </Button>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </OpsSection>
            </>
          )}
        </div>

        {/* Right column: Analysis + Runs + History */}
        <div className="flex flex-col gap-4">
          <OpsSection title="Analysis Output" description="Structured analysis persisted on the incident for UI inspection and later refinement.">
            <JsonBlock value={incident.analysis ?? {}} />
          </OpsSection>

          <OpsSection title="Workflow Runs" description="Current MVP stores run metadata, selected skills and action plans on each incident run.">
            <div className="grid gap-4">
              {incident.runs.map((run) => (
                <Card key={run.id} className="rounded-[1.25rem] border-border/70 bg-background/70">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{run.stage}</CardTitle>
                      <CardDescription className="mt-2">{run.selectedSkills.join(', ') || 'No skills selected'}</CardDescription>
                    </div>
                    <StatusBadge value={run.status} />
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                      {run.selectedSkills.map((skill) => (
                        <Badge key={skill} variant="outline" className="rounded-full">{skill}</Badge>
                      ))}
                    </div>
                    <JsonBlock value={run.plannedActions ?? []} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </OpsSection>

          <OpsSection title="Related History" description="Nearest previously saved incident-history entries from the same project.">
            {incident.relatedHistory.length === 0 ? (
              <div className="text-sm text-muted-foreground">No related history retrieved.</div>
            ) : (
              <div className="grid gap-4">
                {incident.relatedHistory.map((entry) => (
                  <Card key={entry.id} className="rounded-[1.25rem] border-border/70 bg-background/70">
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{entry.title}</CardTitle>
                        <CardDescription className="mt-2">{entry.description ?? entry.fileName}</CardDescription>
                      </div>
                      <Clock3 className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="text-sm leading-7 text-muted-foreground">
                      {(entry.content ?? '').slice(0, 320)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </OpsSection>
        </div>
      </div>
    </OpsPageShell>
  )
}
