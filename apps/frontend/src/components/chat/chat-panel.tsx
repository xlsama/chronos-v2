import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat, type UIMessage } from "@ai-sdk/react";
import type { IncidentDetail } from "@chronos/shared";
import { DefaultChatTransport } from "ai";
import dayjs from "dayjs";
import { Bot, Paperclip, Send, Sparkles, Square } from "lucide-react";
import { AttachmentPreview } from "@/components/ui/attachment-preview";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import { FileUpload, FileUploadContent, FileUploadTrigger } from "@/components/ui/file-upload";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { useFileUpload } from "@/hooks/use-file-upload";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./chat-message";
import { IncidentTimelineEvent, type IncidentTimelineEventItem } from "./incident-timeline-event";

interface ChatPanelProps {
  threadId: string;
  incidentId?: string;
  incident?: IncidentDetail;
  onApprovalDecision?: (approvalId: string, approved: boolean) => void;
  onSaveSummary?: () => void;
  approvalPending?: boolean;
  summaryPending?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function getMessageTimestamp(message: UIMessage, fallback: number) {
  if (message.createdAt instanceof Date) return message.createdAt.getTime();
  if (message.createdAt) return new Date(message.createdAt).getTime();
  return fallback;
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

export function ChatPanel({
  threadId,
  incidentId,
  incident,
  onApprovalDecision,
  onSaveSummary,
  approvalPending = false,
  summaryPending = false,
  className,
  style,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const { items, addFiles, removeFile, getAttachments, reset, isUploading } = useFileUpload();

  // Load initial messages from server
  const { data: initialMessages } = useQuery({
    queryKey: ["chat-messages", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/${threadId}/messages`);
      if (!res.ok) return [];
      return (await res.json()) as UIMessage[];
    },
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId, incidentId },
      }),
    [threadId, incidentId],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: threadId,
    transport,
    experimental_throttle: 50,
  });

  // Sync initial messages when loaded
  useEffect(() => {
    if (initialMessages?.length) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  const isStreaming = status === "streaming";
  const isLoading = status === "submitted" || isStreaming;

  const visibleMessages = useMemo(() => {
    if (!incident || incident.source !== "manual") {
      return messages;
    }

    const incidentText = incident.content.trim();
    const incidentTimestamp = new Date(incident.createdAt).getTime();
    let bootstrapHidden = false;

    return messages.filter((message, index) => {
      if (bootstrapHidden || message.role !== "user") {
        return true;
      }

      const text = getMessageText(message);
      const messageTimestamp = getMessageTimestamp(message, incidentTimestamp + index);
      const isBootstrapMessage =
        text.length > 0 &&
        text === incidentText &&
        Math.abs(messageTimestamp - incidentTimestamp) < 60_000;

      if (isBootstrapMessage) {
        bootstrapHidden = true;
        return false;
      }

      return true;
    });
  }, [incident, messages]);

  const timelineItems = useMemo(() => {
    const systemItems: IncidentTimelineEventItem[] = [];

    if (incident) {
      systemItems.push({
        id: `incident-${incident.id}`,
        kind: "incident",
        createdAt: incident.createdAt,
        incident,
      });

      if (incident.analysis && Object.keys(incident.analysis).length > 0) {
        systemItems.push({
          id: `analysis-${incident.id}`,
          kind: "analysis",
          createdAt: incident.updatedAt,
          analysis: incident.analysis,
        });
      }

      if (incident.finalSummaryDraft) {
        systemItems.push({
          id: `summary-${incident.id}`,
          kind: "summary",
          createdAt: incident.updatedAt,
          summary: incident.finalSummaryDraft,
        });
      }

      for (const run of incident.runs) {
        systemItems.push({
          id: `run-${run.id}`,
          kind: "run",
          createdAt: run.createdAt,
          run,
        });
      }

      for (const approval of incident.approvals) {
        systemItems.push({
          id: `approval-${approval.id}`,
          kind: "approval",
          createdAt: approval.createdAt,
          approval,
        });
      }

      for (const entry of incident.relatedHistory) {
        systemItems.push({
          id: `history-${entry.id}`,
          kind: "history",
          createdAt: entry.createdAt,
          entry,
        });
      }
    }

    const baseTimestamp = Date.now();
    const messageItems = visibleMessages.map((message, index) => ({
      id: `message-${message.id}`,
      kind: "message" as const,
      timestamp: getMessageTimestamp(message, baseTimestamp + index),
      order: 10,
      index,
      message,
    }));

    return [
      ...systemItems.map((item, index) => ({
        id: item.id,
        kind: "system" as const,
        timestamp: new Date(item.createdAt).getTime() || baseTimestamp + index,
        order:
          item.kind === "incident"
            ? 0
            : item.kind === "analysis"
              ? 1
              : item.kind === "run"
                ? 2
                : item.kind === "approval"
                  ? 3
                  : item.kind === "summary"
                    ? 4
                    : 5,
        index,
        item,
      })),
      ...messageItems,
    ].sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }

      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.index - right.index;
    });
  }, [incident, visibleMessages]);

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading || isUploading) return;

    const attachments = getAttachments();
    const composedText =
      attachments.length > 0
        ? `${text}\n\nAttachments:\n${attachments.map((attachment) => `- ${attachment.name}: ${attachment.url}`).join("\n")}`
        : text;

    sendMessage({ text: composedText });
    setInput("");
    reset();
  }, [getAttachments, input, isLoading, isUploading, reset, sendMessage]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.files);
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    },
    [addFiles],
  );

  return (
    <div className={`flex h-full flex-col ${className ?? ""}`} style={style}>
      <div className="border-b border-border/80 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),transparent)] px-4 py-4 md:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Investigation log
            </div>
            <p className="text-sm leading-6 text-foreground">
              时间线整合了告警起点、Agent 分析、审批动作和人工跟进，不再把详情页当成普通 IM 对话。
            </p>
          </div>
          <div className="hidden rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground md:inline-flex md:items-center md:gap-2">
            <Sparkles className="size-3.5" />
            {incident ? dayjs(incident.createdAt).format("MMM D, HH:mm") : "Live thread"}
          </div>
        </div>
      </div>

      <ChatContainerRoot className="flex-1 min-h-0">
        <ChatContainerContent className="mx-auto flex w-full max-w-5xl flex-col px-4 py-5 md:px-8 md:py-7">
          <div className="relative pl-2 md:pl-4">
            <div className="pointer-events-none absolute bottom-0 left-4 top-0 w-px bg-linear-to-b from-border via-border/80 to-transparent md:left-5" />
            <div className="flex flex-col gap-4">
              {timelineItems.length === 0 && !isLoading && (
                <div className="relative ml-10 rounded-[24px] border border-dashed border-border/80 bg-muted/20 px-5 py-5 text-sm text-muted-foreground md:ml-12">
                  这里会持续累积调查记录。你可以补充上下文、上传证据，或要求 Agent 继续推进处理。
                </div>
              )}

              {timelineItems.map((entry) => (
                <div key={entry.id} className="relative">
                  {entry.kind === "message" ? (
                    <ChatMessage
                      message={entry.message}
                      isStreaming={
                        isStreaming &&
                        entry.message === visibleMessages[visibleMessages.length - 1] &&
                        entry.message.role === "assistant"
                      }
                    />
                  ) : (
                    <IncidentTimelineEvent
                      item={entry.item}
                      onApprovalDecision={onApprovalDecision}
                      onSaveSummary={onSaveSummary}
                      approvalPending={approvalPending}
                      summaryPending={summaryPending}
                    />
                  )}
                </div>
              ))}

              {status === "submitted" && (
                <div className="flex gap-3">
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200">
                    <Bot className="size-4" />
                  </div>
                  <div className="min-w-0 max-w-[88%] rounded-[24px] border border-sky-200/80 bg-sky-50/70 px-4 py-3 shadow-[0_16px_40px_-28px_rgba(14,116,144,0.5)] dark:border-sky-400/20 dark:bg-sky-500/10">
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sky-700/80 dark:text-sky-200/80">
                      Agent is working
                    </div>
                    <div className="flex items-center gap-1.5 text-sky-800 dark:text-sky-100">
                      <div className="size-2 rounded-full bg-current animate-pulse" />
                      <div className="size-2 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                      <div className="size-2 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
                      <span className="ml-1 text-sm text-sky-900/70 dark:text-sky-100/70">
                        正在整理分析、工具调用和下一步建议...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <div className="border-t border-border/80 bg-muted/20 p-4 md:p-5">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Continue investigation
              </div>
              <p className="text-sm text-muted-foreground">
                补充线索、上传证据，或要求 Agent 执行下一轮调查。
              </p>
            </div>
          </div>
          <FileUpload onFilesAdded={addFiles} disabled={isLoading}>
            <PromptInput
              value={input}
              onValueChange={setInput}
              isLoading={isLoading}
              onSubmit={handleSubmit}
            >
              {items.length > 0 ? (
                <div className="flex flex-wrap gap-2 px-2 pt-2">
                  {items.map((item) => (
                    <AttachmentPreview key={item.id} item={item} onRemove={removeFile} />
                  ))}
                </div>
              ) : null}
              <PromptInputTextarea
                placeholder={
                  incident?.source === "manual"
                    ? "补充调查指令，或告诉 Agent 下一步该看什么..."
                    : "追加调查上下文，推动 Agent 继续处理..."
                }
                onPaste={handlePaste}
              />
              <PromptInputActions className="justify-between px-2 pb-2">
                <PromptInputAction tooltip="上传文件">
                  <FileUploadTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 rounded-full">
                      <Paperclip className="size-4" />
                    </Button>
                  </FileUploadTrigger>
                </PromptInputAction>
                {isLoading ? (
                  <PromptInputAction tooltip="停止">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full"
                      onClick={stop}
                    >
                      <Square className="size-4" />
                    </Button>
                  </PromptInputAction>
                ) : (
                  <PromptInputAction tooltip="发送">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn("size-8 rounded-full", isUploading && "opacity-60")}
                      onClick={handleSubmit}
                      disabled={!input.trim() || isUploading}
                    >
                      <Send className="size-4" />
                    </Button>
                  </PromptInputAction>
                )}
              </PromptInputActions>
            </PromptInput>
            <FileUploadContent>
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Paperclip className="size-8" />
                <p className="text-lg font-medium">拖拽文件到此处</p>
              </div>
            </FileUploadContent>
          </FileUpload>
        </div>
      </div>
    </div>
  );
}
