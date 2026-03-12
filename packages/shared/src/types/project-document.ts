export interface ProjectDocument {
  id: string;
  projectId: string;
  kind: "knowledge" | "runbook" | "incident_history";
  title: string;
  slug: string;
  description: string | null;
  tags: string[];
  content: string | null;
  filePath: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  extension: string | null;
  checksum: string | null;
  source: "upload" | "markdown" | "agent" | "job";
  status: "pending" | "processing" | "ready" | "error";
  publicationStatus: "active" | "draft" | "published" | "archived";
  chunkCount: number;
  embeddingModel: string | null;
  parserError: string | null;
  createdBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
