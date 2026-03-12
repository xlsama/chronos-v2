export type ProjectDocumentIndexingStatus = "indexed" | "not_indexed";

export type ProjectDocumentIndexingReason =
  | "empty_content"
  | "empty_chunks"
  | "image_without_ocr"
  | "index_write_skipped";

export interface ProjectDocument {
  id: string;
  projectId: string;
  kind: "knowledge" | "runbook" | "incident_history";
  title: string;
  description: string | null;
  tags: string[];
  content: string | null;
  filePath: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  extension: string | null;
  source: "upload" | "markdown" | "agent" | "job";
  status: "pending" | "processing" | "ready" | "error" | "cancelling" | "cancelled";
  publicationStatus: "active" | "draft" | "published" | "archived";
  chunkCount: number;
  embeddingModel: string | null;
  indexingStatus: ProjectDocumentIndexingStatus;
  indexingReason: ProjectDocumentIndexingReason | null;
  indexedAt: string | null;
  vectorCount: number;
  parserError: string | null;
  createdBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
