import { useState } from "react";
import type { UIMessage } from "ai";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageActions, MessageAction } from "@/components/ui/message";
import { getMessageText } from "./chat-utils";

interface ChatMessageActionsProps {
  message: UIMessage;
}

export function ChatMessageActions({ message }: ChatMessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = getMessageText(message);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    </MessageActions>
  );
}
