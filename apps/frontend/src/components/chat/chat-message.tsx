import type { UIMessage } from "ai";
import dayjs from "dayjs";
import { Message, MessageAvatar } from "@/components/ui/message";
import { cn } from "@/lib/utils";
import { ChatMessageActions } from "./chat-message-actions";
import { ChatMessagePart } from "./chat-message-part";
import { getMessageText } from "./chat-utils";

export function ChatMessage({
  message,
  isStreaming,
  incidentId,
  projectId,
}: {
  message: UIMessage;
  isStreaming?: boolean;
  incidentId?: string;
  projectId?: string | null;
}) {
  const isUser = message.role === "user";
  const timestamp = message.createdAt ? dayjs(message.createdAt).format("YYYY-MM-DD HH:mm") : null;

  return (
    <Message className="group/message items-start">
      <MessageAvatar
        src=""
        alt={message.role}
        fallback={isUser ? "O" : "A"}
        className={cn(
          "border shadow-sm",
          isUser
            ? "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-200"
            : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200",
        )}
      />
      <div className="flex min-w-0 max-w-[88%] flex-1 flex-col gap-2 pb-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <span>{isUser ? "用户" : "助手"}</span>
          {timestamp ? (
            <>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>{timestamp}</span>
            </>
          ) : null}
        </div>

        {isUser ? (
          <div className="rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-7">
            <p className="wrap-break-word whitespace-pre-wrap">{getMessageText(message)}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-sm">
            <div className="space-y-3">
              {message.parts.map((part, i) => (
                <ChatMessagePart key={i} part={part} isStreaming={isStreaming} />
              ))}
            </div>
          </div>
        )}

        {!isUser && !isStreaming && (
          <ChatMessageActions
            message={message}
            incidentId={incidentId}
          />
        )}
      </div>
    </Message>
  );
}
