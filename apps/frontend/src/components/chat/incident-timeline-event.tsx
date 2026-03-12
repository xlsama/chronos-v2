import type { AgentRun, IncidentDetail, ProjectDocument, WorkflowApproval } from "@chronos/shared";
import dayjs from "dayjs";
import { Check, Clock3, Save, X } from "lucide-react";
import { AttachmentThumbnails } from "@/components/ops/attachment-thumbnails";
import { JsonBlock } from "@/components/ops/json-block";
import { StatusBadge } from "@/components/ops/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { Message, MessageAvatar } from "@/components/ui/message";
import { cn } from "@/lib/utils";

export type IncidentTimelineEventItem =
  | { id: string; kind: "incident"; createdAt: string; incident: IncidentDetail }
  | { id: string; kind: "analysis"; createdAt: string; analysis: Record<string, unknown> }
  | { id: string; kind: "summary"; createdAt: string; summary: string }
  | { id: string; kind: "run"; createdAt: string; run: AgentRun }
  | { id: string; kind: "approval"; createdAt: string; approval: WorkflowApproval }
  | { id: string; kind: "history"; createdAt: string; entry: ProjectDocument };

export function IncidentTimelineEvent(props: {
  item: IncidentTimelineEventItem;
  onApprovalDecision?: (approvalId: string, approved: boolean) => void;
  onSaveSummary?: () => void;
  approvalPending?: boolean;
  summaryPending?: boolean;
}) {
  const {
    item,
    onApprovalDecision,
    onSaveSummary,
    approvalPending = false,
    summaryPending = false,
  } = props;

  const meta = getEventMeta(item);

  return (
    <Message>
      <MessageAvatar
        src=""
        alt={meta.label}
        fallback={meta.fallback}
        className={cn("border bg-background text-foreground", meta.avatarClassName)}
      />
      <div className="flex max-w-[88%] flex-col gap-2">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <span>{meta.label}</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>{dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}</span>
        </div>
        <div className="rounded-3xl border border-border/80 bg-card/90 px-4 py-4 shadow-sm backdrop-blur-sm md:px-5">
          {renderContent({
            item,
            onApprovalDecision,
            onSaveSummary,
            approvalPending,
            summaryPending,
          })}
        </div>
      </div>
    </Message>
  );
}

function renderContent(props: {
  item: IncidentTimelineEventItem;
  onApprovalDecision?: (approvalId: string, approved: boolean) => void;
  onSaveSummary?: () => void;
  approvalPending: boolean;
  summaryPending: boolean;
}) {
  const { item, onApprovalDecision, onSaveSummary, approvalPending, summaryPending } = props;

  switch (item.kind) {
    case "incident":
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                {item.incident.summary || "Incident investigation"}
              </h3>
              <p className="text-sm leading-7 text-muted-foreground">{item.incident.content}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={item.incident.status} />
              {item.incident.project ? (
                <Badge variant="outline" className="rounded-full">
                  {item.incident.project.name}
                </Badge>
              ) : null}
            </div>
          </div>
          {item.incident.attachments?.length ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Attachments
              </span>
              <AttachmentThumbnails attachments={item.incident.attachments} />
            </div>
          ) : null}
        </div>
      );

    case "analysis":
      return (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Analysis snapshot</h3>
            <p className="text-sm text-muted-foreground">当前事件上持久化的结构化分析结果。</p>
          </div>
          <JsonBlock value={item.analysis} />
        </div>
      );

    case "summary":
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Final summary draft</h3>
              <p className="text-sm text-muted-foreground">确认后可保存到 incident history。</p>
            </div>
            {onSaveSummary ? (
              <Button size="sm" onClick={onSaveSummary} disabled={summaryPending}>
                <Save className="size-4" />
                Save to history
              </Button>
            ) : null}
          </div>
          <Markdown className="prose prose-sm max-w-none text-sm">{item.summary}</Markdown>
        </div>
      );

    case "run":
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">{item.run.stage}</h3>
              <p className="text-sm text-muted-foreground">
                {item.run.selectedSkills.length > 0
                  ? `Selected skills: ${item.run.selectedSkills.join(", ")}`
                  : "No skills selected for this run."}
              </p>
            </div>
            <StatusBadge value={item.run.status} />
          </div>
          {item.run.selectedSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {item.run.selectedSkills.map((skill) => (
                <Badge key={skill} variant="outline" className="rounded-full">
                  {skill}
                </Badge>
              ))}
            </div>
          ) : null}
          {item.run.plannedActions?.length ? <JsonBlock value={item.run.plannedActions} /> : null}
          {item.run.lastError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
              {item.run.lastError}
            </div>
          ) : null}
          {item.run.result ? (
            <div className="rounded-2xl border bg-background px-3 py-3 text-sm leading-7 text-muted-foreground">
              {item.run.result}
            </div>
          ) : null}
        </div>
      );

    case "approval":
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">{item.approval.toolName}</h3>
              <p className="text-sm text-muted-foreground">
                {item.approval.description ?? item.approval.skillSlug}
              </p>
            </div>
            <StatusBadge value={item.approval.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full">
              {item.approval.skillSlug}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {item.approval.serviceName ?? "generic"}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {item.approval.riskLevel}
            </Badge>
          </div>
          <JsonBlock value={item.approval.input} />
          {item.approval.status === "pending" && onApprovalDecision ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={approvalPending}
                onClick={() => onApprovalDecision(item.approval.id, true)}
              >
                <Check className="size-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={approvalPending}
                onClick={() => onApprovalDecision(item.approval.id, false)}
              >
                <X className="size-4" />
                Decline
              </Button>
            </div>
          ) : null}
        </div>
      );

    case "history":
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">{item.entry.title}</h3>
              <p className="text-sm text-muted-foreground">
                {item.entry.description ?? item.entry.fileName ?? "Related incident history"}
              </p>
            </div>
            <Clock3 className="size-4 text-muted-foreground" />
          </div>
          <p className="text-sm leading-7 text-muted-foreground">
            {(item.entry.content ?? "").slice(0, 320) || "No preview available."}
          </p>
        </div>
      );
  }
}

function getEventMeta(item: IncidentTimelineEventItem) {
  switch (item.kind) {
    case "incident":
      return {
        label: "Incident",
        fallback: "I",
        avatarClassName: "bg-primary/10 text-primary",
      };
    case "analysis":
      return {
        label: "Analysis",
        fallback: "A",
        avatarClassName: "bg-sky-500/10 text-sky-700",
      };
    case "summary":
      return {
        label: "Summary",
        fallback: "S",
        avatarClassName: "bg-emerald-500/10 text-emerald-700",
      };
    case "run":
      return {
        label: "Workflow run",
        fallback: "R",
        avatarClassName: "bg-amber-500/10 text-amber-700",
      };
    case "approval":
      return {
        label: "Approval",
        fallback: "P",
        avatarClassName: "bg-rose-500/10 text-rose-700",
      };
    case "history":
      return {
        label: "History",
        fallback: "H",
        avatarClassName: "bg-zinc-500/10 text-zinc-700",
      };
  }
}
