import type { IncidentDetail, ProjectDocument } from "@chronos/shared";
import dayjs from "dayjs";
import { Clock3, Save } from "lucide-react";
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
  | { id: string; kind: "history"; createdAt: string; entry: ProjectDocument };

export function IncidentTimelineEvent(props: {
  item: IncidentTimelineEventItem;
  onSaveSummary?: () => void;
  summaryPending?: boolean;
}) {
  const {
    item,
    onSaveSummary,
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
            onSaveSummary,
            summaryPending,
          })}
        </div>
      </div>
    </Message>
  );
}

function renderContent(props: {
  item: IncidentTimelineEventItem;
  onSaveSummary?: () => void;
  summaryPending: boolean;
}) {
  const { item, onSaveSummary, summaryPending } = props;

  switch (item.kind) {
    case "incident":
      const sourceLabel = item.incident.source === "manual" ? "手动触发" : "告警触发";

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                {item.incident.source === "manual"
                  ? "运维人员发起了此调查"
                  : item.incident.summary || "事件调查"}
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
                附件
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
            <h3 className="text-base font-semibold text-foreground">分析快照</h3>
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
              <h3 className="text-base font-semibold text-foreground">最终总结草稿</h3>
              <p className="text-sm text-muted-foreground">确认后可保存到 incident history。</p>
            </div>
            {onSaveSummary ? (
              <Button size="sm" onClick={onSaveSummary} disabled={summaryPending}>
                <Save className="size-4" />
                保存到历史
              </Button>
            ) : null}
          </div>
          <Markdown className="prose prose-sm max-w-none text-sm">{item.summary}</Markdown>
        </div>
      );

    case "history":
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">{item.entry.title}</h3>
              <p className="text-sm text-muted-foreground">
                {item.entry.description ?? item.entry.fileName ?? "相关事件历史"}
              </p>
            </div>
            <Clock3 className="size-4 text-muted-foreground" />
          </div>
          <p className="text-sm leading-7 text-muted-foreground">
            {(item.entry.content ?? "").slice(0, 320) || "暂无预览内容"}
          </p>
        </div>
      );
  }
}

function getEventMeta(item: IncidentTimelineEventItem) {
  switch (item.kind) {
    case "incident":
      return {
        label: item.incident.source === "manual" ? "手动触发" : "事件",
        fallback: item.incident.source === "manual" ? "手" : "事",
        avatarClassName:
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200",
        badgeClassName: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
        cardClassName:
          "border-amber-200/80 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-500/8",
      };
    case "analysis":
      return {
        label: "分析",
        fallback: "析",
        avatarClassName:
          "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200",
        badgeClassName: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
        cardClassName: "border-sky-200/80 bg-sky-50/60 dark:border-sky-400/20 dark:bg-sky-500/8",
      };
    case "summary":
      return {
        label: "总结",
        fallback: "结",
        avatarClassName:
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
        badgeClassName:
          "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
        cardClassName:
          "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-500/8",
      };
    case "history":
      return {
        label: "历史",
        fallback: "史",
        avatarClassName:
          "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-400/20 dark:bg-zinc-500/10 dark:text-zinc-200",
        badgeClassName: "bg-zinc-100 text-zinc-900 dark:bg-zinc-500/15 dark:text-zinc-200",
        cardClassName:
          "border-zinc-200/80 bg-zinc-50/70 dark:border-zinc-400/20 dark:bg-zinc-500/8",
      };
  }
}
