import type { DocumentStatus, DocumentType } from "./enums";

export interface KbProject {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  documentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KbDocument {
  id: string;
  projectId: string;
  title: string;
  type: DocumentType;
  content: string | null;
  originalUrl: string | null;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  embeddingModel: string | null;
  createdAt: string;
  updatedAt: string;
}
