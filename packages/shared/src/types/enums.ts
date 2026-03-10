// ── Incident ────────────────────────────────────────────────
export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export type IncidentStatus =
  | "new"
  | "triaging"
  | "in_progress"
  | "waiting_human"
  | "resolved"
  | "closed";

export type ProcessingMode = "automatic" | "semi_automatic";

// ── Message ─────────────────────────────────────────────────
export type MessageRole = "system" | "user" | "assistant";

// ── Connection ──────────────────────────────────────────────
export type ConnectionType =
  | "mysql"
  | "postgresql"
  | "redis"
  | "grafana"
  | "elasticsearch"
  | "kubernetes"
  | "prometheus";

export type ConnectionStatus = "connected" | "disconnected" | "error";
