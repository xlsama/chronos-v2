import { useState } from "react";
import { AlertTriangle, Check, X, Shield, Terminal, Database, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ApprovalRequiredEvent, RiskLevel } from "@chronos/shared";

interface ToolApprovalCardProps {
  approval: ApprovalRequiredEvent;
  status?: "pending" | "approved" | "declined";
  onResolve?: (approvalId: string, action: "approve" | "decline") => void;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  none: { label: "无", color: "text-muted-foreground", variant: "secondary" },
  low: { label: "低", color: "text-blue-600 dark:text-blue-400", variant: "secondary" },
  medium: { label: "中", color: "text-amber-600 dark:text-amber-400", variant: "outline" },
  high: { label: "高", color: "text-red-600 dark:text-red-400", variant: "destructive" },
};

function getToolIcon(toolName: string) {
  if (toolName === "runContainerCommand") return Terminal;
  if (toolName === "executeMcpTool") return Database;
  if (toolName === "updateIncidentStatus") return Power;
  return Shield;
}

function formatToolArgs(approval: ApprovalRequiredEvent): string | null {
  const args = approval.toolArgs;
  if (!args) return null;

  if (approval.toolName === "runContainerCommand") {
    return typeof args.command === "string" ? args.command : null;
  }

  if (approval.toolName === "executeMcpTool") {
    const nestedArgs = args.args;
    const payload =
      nestedArgs && typeof nestedArgs === "object" && !Array.isArray(nestedArgs)
        ? (nestedArgs as Record<string, unknown>)
        : args;
    const sql = payload.query ?? payload.sql ?? payload.statement;
    if (typeof sql === "string") return sql;
    const mcpToolName = typeof args.toolName === "string" ? args.toolName : null;
    return mcpToolName ? `Tool: ${mcpToolName}` : null;
  }

  if (approval.toolName === "updateIncidentStatus") {
    return typeof args.status === "string" ? `Status: ${args.status}` : null;
  }

  return null;
}

export function ToolApprovalCard({ approval, status = "pending", onResolve }: ToolApprovalCardProps) {
  const [resolving, setResolving] = useState(false);
  const risk = RISK_CONFIG[approval.riskLevel] ?? RISK_CONFIG.medium;
  const Icon = getToolIcon(approval.toolName);
  const detail = formatToolArgs(approval);
  const isPending = status === "pending";

  const handleResolve = async (action: "approve" | "decline") => {
    if (!onResolve || resolving) return;
    setResolving(true);
    onResolve(approval.id, action);
  };

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 shadow-sm dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
        <AlertTriangle className="size-4" />
      </div>
      <div className="min-w-0 max-w-[88%] rounded-2xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 shadow-sm dark:border-amber-400/20 dark:bg-amber-500/5">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Agent 请求执行操作
          </span>
          <Badge variant={risk.variant} className="text-[10px] px-1.5 py-0">
            {risk.label}风险
          </Badge>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="size-3.5 shrink-0" />
            <span className="font-medium text-foreground">{approval.toolName}</span>
          </div>

          {detail && (
            <pre className="overflow-x-auto rounded-md bg-muted/60 px-2.5 py-1.5 text-xs font-mono text-foreground/90 whitespace-pre-wrap break-all">
              {detail}
            </pre>
          )}

          {approval.reason && (
            <p className="text-xs text-muted-foreground">{approval.reason}</p>
          )}
        </div>

        {isPending ? (
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => handleResolve("decline")}
              disabled={resolving}
            >
              <X className="mr-1 size-3" />
              拒绝
            </Button>
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => handleResolve("approve")}
              disabled={resolving}
            >
              <Check className="mr-1 size-3" />
              批准执行
            </Button>
          </div>
        ) : (
          <div className="mt-2">
            {status === "approved" ? (
              <Badge variant="secondary" className="text-[10px] text-green-700 dark:text-green-400">
                <Check className="mr-1 size-3" />
                已批准
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] text-red-700 dark:text-red-400">
                <X className="mr-1 size-3" />
                已拒绝
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
