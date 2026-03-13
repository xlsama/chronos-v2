import { useState } from "react";
import type { UIMessage } from "ai";
import { BrainCircuit, Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageActions, MessageAction } from "@/components/ui/message";
import { useArchiveToHistory } from "@/lib/queries/ops";
import { getMessageText } from "./chat-utils";

interface ChatMessageActionsProps {
  message: UIMessage;
  incidentId?: string;
}

export function ChatMessageActions({
  message,
  incidentId,
}: ChatMessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [archived, setArchived] = useState(false);
  const archiveMutation = useArchiveToHistory();

  const handleCopy = () => {
    const text = getMessageText(message);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleArchive = () => {
    if (!incidentId || archived) return;
    const text = getMessageText(message);
    if (!text) return;
    archiveMutation.mutate(
      { incidentId, content: text, messageId: message.id },
      { onSuccess: () => setArchived(true) },
    );
  };

  return (
    <MessageActions className="mt-1">
      <MessageAction tooltip={copied ? "已复制" : "复制"}>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-md"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </MessageAction>

      {incidentId && (
        <MessageAction tooltip="将此回复保存为事件记忆">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-md px-2 text-xs"
            onClick={handleArchive}
            disabled={archived || archiveMutation.isPending}
          >
            {archiveMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                保存中...
              </>
            ) : archived ? (
              <>
                <Check className="size-3.5" />
                已添加
              </>
            ) : (
              <>
                <BrainCircuit className="size-3.5" />
                添加到记忆
              </>
            )}
          </Button>
        </MessageAction>
      )}
    </MessageActions>
  );
}
