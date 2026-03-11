import type { ConnectionStatus, ConnectionType, McpStatus } from "./enums";

export type ConnectionImportSource = "manual" | "kb";

export interface ConnectionImportMetadataDocument {
  id: string;
  title: string;
}

export interface ConnectionImportMetadata {
  sourceDocuments: ConnectionImportMetadataDocument[];
  warnings: string[];
  confidence: number | null;
  sourceExcerpt: string | null;
  importedAt: string;
}

export interface Connection {
  id: string;
  name: string;
  type: ConnectionType;
  config: Record<string, unknown>;
  status: ConnectionStatus;
  mcpStatus: McpStatus;
  mcpError: string | null;
  lastTestedAt: string | null;
  kbProjectId: string | null;
  importSource: ConnectionImportSource;
  importMetadata: ConnectionImportMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionImportCandidate {
  id: string;
  name: string;
  type: ConnectionType;
  config: Record<string, string>;
  missingFields: string[];
  warnings: string[];
  confidence: number | null;
  sourceDocuments: ConnectionImportMetadataDocument[];
  sourceExcerpt: string | null;
  hasAllRequiredFields: boolean;
  duplicateConnectionIds: string[];
  duplicateConnectionNames: string[];
}

export interface ConnectionImportPreviewResponse {
  kbProjectId: string;
  projectName: string;
  totalDocumentCount: number;
  readyDocumentCount: number;
  warnings: string[];
  imports: ConnectionImportCandidate[];
}

export interface ConnectionImportCommitItemError {
  candidateId: string;
  name: string;
  reason: string;
}

export interface ConnectionImportCommitResponse {
  created: Connection[];
  failed: ConnectionImportCommitItemError[];
  skipped: ConnectionImportCommitItemError[];
}
