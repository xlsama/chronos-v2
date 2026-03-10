// ── Incident ────────────────────────────────────────────────
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
  | "mongodb"
  | "clickhouse"
  | "elasticsearch"
  | "kafka"
  | "rabbitmq"
  | "kubernetes"
  | "docker"
  | "argocd"
  | "grafana"
  | "prometheus"
  | "sentry"
  | "jenkins";

export type ConnectionStatus = "connected" | "disconnected" | "error";
