import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat, type UIMessage } from "@ai-sdk/react";
import type { IncidentDetail } from "@chronos/shared";
import { DefaultChatTransport } from "ai";
import { Bot, Plus, Send, Square } from "lucide-react";
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
import { useChatSubscription } from "@/hooks/use-chat-subscription";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./chat-message";
import { getMessageText } from "./chat-utils";
import { IncidentTimelineEvent, type IncidentTimelineEventItem } from "./incident-timeline-event";

interface ChatPanelProps {
  threadId: string;
  incidentId?: string;
  incident?: IncidentDetail;
  onSaveSummary?: () => void;
  summaryPending?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const TIMELINE_ORDER: Record<IncidentTimelineEventItem["kind"], number> = {
  incident: 0,
  analysis: 1,
  summary: 2,
  history: 3,
};

function getMessageTimestamp(message: UIMessage, fallback: number) {
  if (message.createdAt instanceof Date) return message.createdAt.getTime();
  if (message.createdAt) return new Date(message.createdAt).getTime();
  return fallback;
}

export function ChatPanel({
  threadId,
  incidentId,
  incident,
  onSaveSummary,
  summaryPending = false,
  className,
  style,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [backgroundStreaming, setBackgroundStreaming] = useState(false);
  const queryClient = useQueryClient();
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

  // SSE subscription to track background agent state
  const onStreamStart = useCallback(() => setBackgroundStreaming(true), []);
  const onStreamChunk = useCallback(() => {
    setBackgroundStreaming((prev) => (prev ? prev : true));
  }, []);
  const onStreamEnd = useCallback(() => {
    setBackgroundStreaming(false);
    queryClient.invalidateQueries({ queryKey: ["chat-messages", threadId] });
  }, [queryClient, threadId]);
  const onStreamAborted = useCallback(() => setBackgroundStreaming(false), []);
  const onStreamError = useCallback(() => setBackgroundStreaming(false), []);

  useChatSubscription({
    threadId,
    enabled: true,
    onStreamStart,
    onStreamChunk,
    onStreamEnd,
    onStreamAborted,
    onStreamError,
  });

  // Unified active state: interactive chat OR background agent
  const isAgentActive = isLoading || backgroundStreaming;

  const handleStop = useCallback(() => {
    if (isLoading) stop();
    if (backgroundStreaming) {
      fetch(`/api/chat/${threadId}/abort`, { method: "POST" });
      setBackgroundStreaming(false);
    }
  }, [isLoading, backgroundStreaming, stop, threadId]);

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
        order: TIMELINE_ORDER[item.kind] ?? 99,
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
    if (!text || isAgentActive || isUploading) return;

    const attachments = getAttachments();
    const composedText =
      attachments.length > 0
        ? `${text}\n\nAttachments:\n${attachments.map((attachment) => `- ${attachment.name}: ${attachment.url}`).join("\n")}`
        : text;

    sendMessage({ text: composedText });
    setInput("");
    reset();
  }, [getAttachments, input, isAgentActive, isUploading, reset, sendMessage]);

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
      <ChatContainerRoot className="flex-1 min-h-0">
        <ChatContainerContent className="mx-auto flex w-full max-w-5xl flex-col px-4 py-5 md:px-6 md:py-5">
          <div className="flex flex-col gap-4">
            {timelineItems.length === 0 && !isAgentActive && (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-5 py-5 text-sm text-muted-foreground">
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
                    onSaveSummary={onSaveSummary}
                    summaryPending={summaryPending}
                  />
                )}
              </div>
            ))}

            {(status === "submitted" || backgroundStreaming) && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200">
                  <Bot className="size-4" />
                </div>
                <div className="min-w-0 max-w-[88%] rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Agent is working
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <div className="size-2 rounded-full bg-current animate-pulse" />
                    <div className="size-2 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                    <div className="size-2 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
                    <span className="ml-1 text-sm">
                      正在整理分析、工具调用和下一步建议...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <div className="border-t border-border/80 p-3 md:p-4">
        <div className="mx-auto w-full max-w-5xl">
          <FileUpload onFilesAdded={addFiles} disabled={isAgentActive}>
            <PromptInput
              value={input}
              onValueChange={setInput}
              isLoading={isAgentActive}
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
                      <Plus className="size-4" />
                    </Button>
                  </FileUploadTrigger>
                </PromptInputAction>
                {isAgentActive ? (
                  <PromptInputAction tooltip="停止">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full"
                      onClick={handleStop}
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
                <Plus className="size-8" />
                <p className="text-lg font-medium">拖拽文件到此处</p>
              </div>
            </FileUploadContent>
          </FileUpload>
        </div>
      </div>
    </div>
  );
}
