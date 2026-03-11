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

export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; mimeType?: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown }

export interface IncidentMessage {
  id: string;
  incidentId: string;
  role: MessageRole;
  content: string;
  contentParts: MessageContentPart[] | null;
  attachments: Attachment[] | null;
  userId: string | null;
  createdAt: string;
}
