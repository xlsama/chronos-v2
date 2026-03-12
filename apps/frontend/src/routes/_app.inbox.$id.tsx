import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ChatPanel } from "@/components/chat/chat-panel";
import { StatusBadge } from "@/components/ops/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { opsQueries, useDecideApproval, useSaveIncidentSummary } from "@/lib/queries/ops";

export const Route = createFileRoute("/_app/inbox/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(opsQueries.incidentDetail(params.id)),
  component: IncidentDetailPage,
});

function IncidentDetailPage() {
  const { id } = Route.useParams();
  const { data: incident } = useSuspenseQuery(opsQueries.incidentDetail(id));
  const saveSummary = useSaveIncidentSummary();
  const decideApproval = useDecideApproval();

  const threadId = incident.threadId ?? `incident-${incident.id}`;

  return (
    <div className="min-h-full bg-background px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="sticky top-4 z-10 rounded-[28px] border border-border/70 bg-background/90 px-5 py-4 shadow-sm backdrop-blur md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Incident workspace
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {incident.summary || "Incident investigation"}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {incident.content}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{dayjs(incident.createdAt).format("YYYY-MM-DD HH:mm")}</span>
                {incident.project ? (
                  <Badge variant="outline" className="rounded-full">
                    {incident.project.name}
                  </Badge>
                ) : null}
                {incident.runs.length > 0 ? (
                  <Badge variant="outline" className="rounded-full">
                    {incident.runs.length} runs
                  </Badge>
                ) : null}
                {incident.approvalCount > 0 ? (
                  <Badge variant="outline" className="rounded-full">
                    {incident.approvalCount} approvals
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={incident.status} />
              {saveSummary.isPending ? (
                <Button size="sm" variant="outline" disabled>
                  Saving...
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-border/70 bg-card/40 shadow-sm">
          <ChatPanel
            threadId={threadId}
            incidentId={incident.id}
            incident={incident}
            onApprovalDecision={(approvalId, approved) =>
              decideApproval.mutate({ incidentId: incident.id, approvalId, approved })
            }
            onSaveSummary={
              incident.finalSummaryDraft && incident.status !== "resolved"
                ? () => saveSummary.mutate(incident.id)
                : undefined
            }
            approvalPending={decideApproval.isPending}
            summaryPending={saveSummary.isPending}
            className="min-h-0"
            style={{ height: "calc(100vh - 14rem)", minHeight: "720px" }}
          />
        </div>
      </div>
    </div>
  );
}
