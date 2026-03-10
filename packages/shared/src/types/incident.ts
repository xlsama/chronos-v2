import type { IncidentStatus, MessageRole, ProcessingMode } from "./enums";

export interface Attachment {
  type: "image" | "file";
  url: string;
  name: string;
  mimeType: string;
}

export interface Incident {
  id: string;
  content: string;
  summary: string | null;
  attachments: Attachment[] | null;
  source: string | null;
  status: IncidentStatus;
  processingMode: ProcessingMode | null;
  threadId: string | null;
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
