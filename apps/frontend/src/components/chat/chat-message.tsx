import type { UIMessage } from "ai";
import dayjs from "dayjs";
import { Message, MessageAvatar } from "@/components/ui/message";
import { cn } from "@/lib/utils";
import { ChatMessagePart } from "./chat-message-part";

function extractText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

export function ChatMessage({
  message,
  isStreaming,
}: {
  message: UIMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  const timestamp = message.createdAt ? dayjs(message.createdAt).format("YYYY-MM-DD HH:mm") : null;

  return (
    <Message className="items-start">
      <MessageAvatar
        src=""
        alt={message.role}
        fallback={isUser ? "O" : "A"}
        className={cn(
          "relative z-10 border shadow-sm",
          isUser
            ? "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-200"
            : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200",
        )}
      />
      <div className="flex min-w-0 max-w-[88%] flex-1 flex-col gap-2 pb-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <span
            className={cn(
              "rounded-full px-2 py-1",
              isUser
                ? "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200"
                : "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
            )}
          >
            {isUser ? "Operator note" : "Agent response"}
          </span>
          {timestamp ? (
            <>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>{timestamp}</span>
            </>
          ) : null}
        </div>

        {isUser ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm leading-7 text-foreground shadow-[0_18px_48px_-34px_rgba(15,23,42,0.45)] dark:border-slate-400/20 dark:bg-slate-500/8">
            <p className="wrap-break-word whitespace-pre-wrap">{extractText(message)}</p>
          </div>
        ) : (
          <div className="rounded-[24px] border border-sky-200/80 bg-background/95 px-4 py-3 shadow-[0_18px_48px_-34px_rgba(14,116,144,0.32)] dark:border-sky-400/20 dark:bg-sky-500/6">
            <div className="space-y-3">
              {message.parts.map((part, i) => (
                <ChatMessagePart key={i} part={part} isStreaming={isStreaming} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Message>
  );
}
