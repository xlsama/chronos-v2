import type {
  IncidentSeverity,
  IncidentStatus,
  MessageRole,
  ProcessingMode,
} from "./enums";

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  source: string | null;
  sourceId: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  processingMode: ProcessingMode | null;
  category: string | null;
  threadId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentMessage {
  id: string;
  incidentId: string;
  role: MessageRole;
  content: string;
  contentParts: unknown | null;
  attachments: unknown | null;
  userId: string | null;
  createdAt: string;
}
