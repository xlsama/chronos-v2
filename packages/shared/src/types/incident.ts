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

export interface AgentRun {
  id: string;
  incidentId: string;
  projectId: string | null;
  status: "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";
  stage: string;
  selectedSkills: string[];
  analysis?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  plannedActions?: Record<string, unknown>[] | null;
  result?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowApproval {
  id: string;
  agentRunId: string;
  incidentId: string;
  projectId: string | null;
  skillSlug: string;
  toolKey: string;
  toolName: string;
  serviceId: string | null;
  serviceName: string | null;
  riskLevel: "none" | "low" | "medium" | "high";
  approvalMode: "auto" | "manual";
  input: Record<string, unknown>;
  description: string | null;
  status: "pending" | "approved" | "declined" | "expired";
  decidedAt: string | null;
  declineReason: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface IncidentDetail extends Incident {
  project: Project | null;
  approvals: WorkflowApproval[];
  runs: AgentRun[];
  approvalCount: number;
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
