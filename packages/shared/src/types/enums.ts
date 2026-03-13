// ── Incident ────────────────────────────────────────────────
export type IncidentStatus =
  | "new"
  | "triaging"
  | "in_progress"
  | "waiting_human"
  | "resolved"
  | "summarizing"
  | "completed";


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
  | "jenkins"
  | "datadog"
  | "pagerduty"
  | "opsgenie"
  | "apisix"
  | "kong"
  | "airflow"
  | "loki"
  | "ssh";

export type ConnectionStatus = "connected" | "disconnected" | "error";

// ── MCP ─────────────────────────────────────────────────────
export type McpStatus = "idle" | "registering" | "registered" | "error";

// ── Knowledge Base ──────────────────────────────────────────
export type DocumentType = "markdown" | "pdf" | "xlsx" | "csv" | "docx";
export type DocumentStatus =
  | "pending"
  | "processing"
  | "ready"
  | "error"
  | "cancelling"
  | "cancelled";

// ── Tool Policy ────────────────────────────────────────────
export type RiskLevel = "none" | "low" | "medium" | "high";
export type ApprovalStatus = "pending" | "approved" | "declined" | "expired";
