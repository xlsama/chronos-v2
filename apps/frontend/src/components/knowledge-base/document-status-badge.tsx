import type { DocumentStatus } from "@chronos/shared";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<DocumentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "等待处理", variant: "outline" },
  processing: { label: "处理中", variant: "secondary" },
  ready: { label: "就绪", variant: "default" },
  error: { label: "错误", variant: "destructive" },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
