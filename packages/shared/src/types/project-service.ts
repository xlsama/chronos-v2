import type { ConnectionStatus, ConnectionType } from "./enums";

export interface ProjectService {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  type: ConnectionType;
  description: string | null;
  config: Record<string, unknown>;
  status: ConnectionStatus;
  healthSummary: string | null;
  lastCheckedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
