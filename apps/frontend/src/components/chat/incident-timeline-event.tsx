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
    <Message className="items-start">
      <MessageAvatar
        src=""
        alt={meta.label}
        fallback={meta.fallback}
        className={cn(
          "relative z-10 border bg-background text-foreground shadow-sm",
          meta.avatarClassName,
        )}
      />
      <div className="flex min-w-0 max-w-[88%] flex-1 flex-col gap-2 pb-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <span className={cn("rounded-full px-2 py-1", meta.badgeClassName)}>{meta.label}</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>{dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}</span>
        </div>
        <div
          className={cn(
            "rounded-[26px] border px-4 py-4 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.55)] backdrop-blur-sm md:px-5",
            meta.cardClassName,
          )}
        >
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
      const sourceLabel = item.incident.source === "manual" ? "Manual trigger" : "Inbound incident";

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                {item.incident.source === "manual"
                  ? "Operator started this investigation"
                  : item.incident.summary || "Incident investigation"}
              </h3>
              <p className="text-sm leading-7 text-muted-foreground">
                {item.incident.source === "manual"
                  ? "这条记录代表人工发起调查，本身就是时间线起点，不再额外重复生成一条聊天消息。"
                  : "告警或外部事件进入系统后，调查时间线从这里开始。"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={item.incident.status} />
              <Badge variant="outline" className="rounded-full">
                {sourceLabel}
              </Badge>
              {item.incident.project ? (
                <Badge variant="outline" className="rounded-full">
                  {item.incident.project.name}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="rounded-[22px] border border-border/70 bg-background/80 px-4 py-4 text-sm leading-7 text-foreground shadow-inner">
            {item.incident.content}
          </div>
          {item.incident.attachments?.length ? (
            <div className="flex items-center gap-3 rounded-[22px] border border-dashed border-border/80 bg-background/50 px-3 py-2">
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
        label: item.incident.source === "manual" ? "Manual trigger" : "Incident",
        fallback: item.incident.source === "manual" ? "M" : "I",
        avatarClassName:
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200",
        badgeClassName: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
        cardClassName:
          "border-amber-200/80 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-500/8",
      };
    case "analysis":
      return {
        label: "Analysis",
        fallback: "A",
        avatarClassName:
          "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200",
        badgeClassName: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
        cardClassName: "border-sky-200/80 bg-sky-50/60 dark:border-sky-400/20 dark:bg-sky-500/8",
      };
    case "summary":
      return {
        label: "Summary",
        fallback: "S",
        avatarClassName:
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
        badgeClassName:
          "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
        cardClassName:
          "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-500/8",
      };
    case "run":
      return {
        label: "Workflow run",
        fallback: "R",
        avatarClassName:
          "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200",
        badgeClassName: "bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200",
        cardClassName:
          "border-violet-200/80 bg-violet-50/55 dark:border-violet-400/20 dark:bg-violet-500/8",
      };
    case "approval":
      return {
        label: "Approval",
        fallback: "P",
        avatarClassName:
          "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200",
        badgeClassName: "bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200",
        cardClassName:
          "border-rose-200/80 bg-rose-50/60 dark:border-rose-400/20 dark:bg-rose-500/8",
      };
    case "history":
      return {
        label: "History",
        fallback: "H",
        avatarClassName:
          "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-400/20 dark:bg-zinc-500/10 dark:text-zinc-200",
        badgeClassName: "bg-zinc-100 text-zinc-900 dark:bg-zinc-500/15 dark:text-zinc-200",
        cardClassName:
          "border-zinc-200/80 bg-zinc-50/70 dark:border-zinc-400/20 dark:bg-zinc-500/8",
      };
  }
}
