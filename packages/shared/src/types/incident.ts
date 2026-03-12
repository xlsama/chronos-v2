import type { IncidentStatus, MessageRole, ProcessingMode } from "./enums";
import type { ProjectDocument } from "./project-document";
import type { Project } from "./project";

export interface Attachment {
  type: "image" | "file";
  url: string;
  name: string;
  mimeType: string;
}

export interface Incident {
  id: string;
  projectId?: string | null;
  content: string;
  summary: string | null;
  attachments: Attachment[] | null;
  source: string | null;
  status: IncidentStatus;
  processingMode: ProcessingMode | null;
  threadId: string | null;
  analysis?: Record<string, unknown> | null;
  selectedSkills?: string[];
  finalSummaryDraft?: string | null;
  resolutionNotes?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentDetail extends Incident {
  project: Project | null;
  relatedHistory: ProjectDocument[];
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
