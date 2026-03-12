import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat, type UIMessage } from "@ai-sdk/react";
import type { IncidentDetail } from "@chronos/shared";
import { DefaultChatTransport } from "ai";
import { Paperclip, Send, Square } from "lucide-react";
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
    const messageItems = messages.map((message, index) => ({
      id: `message-${message.id}`,
      kind: "message" as const,
      timestamp:
        message.createdAt instanceof Date
          ? message.createdAt.getTime()
          : message.createdAt
            ? new Date(message.createdAt).getTime()
            : baseTimestamp + index,
      message,
    }));

    return [
      ...systemItems.map((item, index) => ({
        id: item.id,
        kind: "system" as const,
        timestamp: new Date(item.createdAt).getTime() || baseTimestamp + index,
        item,
      })),
      ...messageItems,
    ].sort((left, right) => left.timestamp - right.timestamp);
  }, [incident, messages]);

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
      <ChatContainerRoot className="flex-1 min-h-0">
        <ChatContainerContent className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-6">
          {timelineItems.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              开始与 Agent 对话，分析和解决此事件...
            </div>
          )}

          {timelineItems.map((entry) =>
            entry.kind === "message" ? (
              <ChatMessage
                key={entry.id}
                message={entry.message}
                isStreaming={
                  isStreaming &&
                  entry.message === messages[messages.length - 1] &&
                  entry.message.role === "assistant"
                }
              />
            ) : (
              <IncidentTimelineEvent
                key={entry.id}
                item={entry.item}
                onApprovalDecision={onApprovalDecision}
                onSaveSummary={onSaveSummary}
                approvalPending={approvalPending}
                summaryPending={summaryPending}
              />
            ),
          )}

          {status === "submitted" && (
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                A
              </div>
              <div className="rounded-lg p-2 bg-secondary">
                <div className="flex items-center gap-1.5">
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse" />
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse [animation-delay:150ms]" />
                  <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <div className="border-t p-4">
        <div className="mx-auto w-full max-w-4xl">
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
              <PromptInputTextarea placeholder="输入消息与 Agent 对话..." onPaste={handlePaste} />
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
                      className="size-8 rounded-full"
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
