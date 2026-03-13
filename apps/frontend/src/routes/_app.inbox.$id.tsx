import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ChatPanel } from "@/components/chat/chat-panel";
import { StatusBadge } from "@/components/ops/status-badge";
import { Badge } from "@/components/ui/badge";
import { isIncidentFinalSummarySaved } from "@/lib/final-summary";
import { getProjectDisplayName } from "@/lib/project-display";
import { opsQueries, useSaveIncidentSummary } from "@/lib/queries/ops";

export const Route = createFileRoute("/_app/inbox/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(opsQueries.incidentDetail(params.id)),
  component: IncidentDetailPage,
});

function IncidentDetailPage() {
  const { id } = Route.useParams();
  const { data: incident } = useSuspenseQuery(opsQueries.incidentDetail(id));
  const saveSummary = useSaveIncidentSummary();
  const summarySaved = isIncidentFinalSummarySaved(incident);

  const threadId = incident.threadId ?? `incident-${incident.id}`;
  const sourceLabel = incident.source === "manual" ? "Manual" : "Inbound";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/80 px-4 py-2.5 md:px-6">
        <h1 className="truncate text-sm font-medium text-foreground">
          {incident.summary || "Incident investigation"}
        </h1>
        <span className="h-1 w-1 shrink-0 rounded-full bg-border" />
        <StatusBadge value={incident.status} />
        <Badge variant="outline" className="shrink-0 rounded-full text-xs">
          {sourceLabel}
        </Badge>
        {incident.project ? (
          <Badge variant="outline" className="shrink-0 rounded-full text-xs">
            {getProjectDisplayName(incident.project)}
          </Badge>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {dayjs(incident.createdAt).format("YYYY-MM-DD HH:mm")}
          </span>
        </div>
      </div>

      <ChatPanel
        threadId={threadId}
        incidentId={incident.id}
        incident={incident}
        onSaveSummary={
          incident.finalSummaryDraft && incident.projectId && !summarySaved
            ? () => saveSummary.mutate(incident.id)
            : undefined
        }
        summaryPending={saveSummary.isPending}
        summarySaved={summarySaved}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
