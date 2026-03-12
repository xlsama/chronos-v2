import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Activity, Bot, CalendarClock, FolderKanban, ShieldAlert } from "lucide-react";
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
  const sourceLabel = incident.source === "manual" ? "Manual trigger" : "Inbound incident";
  const stats = [
    {
      label: "Source",
      value: sourceLabel,
      icon: Bot,
    },
    {
      label: "Project",
      value: incident.project?.name ?? "Unassigned",
      icon: FolderKanban,
    },
    {
      label: "Runs",
      value: `${incident.runs.length}`,
      icon: Activity,
    },
    {
      label: "Approvals",
      value: `${incident.approvalCount}`,
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_24%)] px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="overflow-hidden rounded-[32px] border border-border/80 bg-background/95 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="border-b border-border/70 px-5 py-5 lg:border-b-0 lg:border-r lg:px-7 lg:py-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border-0 bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                    Investigation timeline
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full px-3 py-1 text-xs text-muted-foreground"
                  >
                    {sourceLabel}
                  </Badge>
                  <StatusBadge value={incident.status} />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    {incident.summary || "Incident investigation"}
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                    这里展示调查过程而不是普通聊天记录。原始告警内容、分析结果、审批和人工跟进都会合并到同一条时间线里。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5">
                    <CalendarClock className="size-4" />
                    <span>{dayjs(incident.createdAt).format("YYYY-MM-DD HH:mm")}</span>
                  </div>
                  {incident.project ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1.5">
                      {incident.project.name}
                    </Badge>
                  ) : null}
                  {incident.finalSummaryDraft ? (
                    <Badge variant="outline" className="rounded-full px-3 py-1.5">
                      Summary draft ready
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {saveSummary.isPending ? (
                    <Button size="sm" variant="outline" disabled>
                      Saving...
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-3 bg-muted/20 px-5 py-5 lg:px-6 lg:py-6">
              {stats.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-[24px] border border-border/70 bg-background/90 px-4 py-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.5)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        {label}
                      </div>
                      <div className="text-lg font-semibold text-foreground">{value}</div>
                    </div>
                    <div className="rounded-2xl bg-muted/70 p-2 text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                  </div>
                </div>
              ))}
              {incident.resolutionNotes ? (
                <div className="rounded-[24px] border border-border/70 bg-background/90 px-4 py-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.5)]">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Latest note
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {incident.resolutionNotes}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-border/80 bg-background/90 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.4)]">
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
            style={{ height: "calc(100vh - 16rem)", minHeight: "720px" }}
          />
        </div>
      </div>
    </div>
  );
}
