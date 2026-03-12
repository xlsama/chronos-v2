import type { ConnectionStatus, ConnectionType, McpStatus } from "./enums";

export interface Connection {
  id: string;
  name: string;
  type: ConnectionType;
  config: Record<string, unknown>;
  status: ConnectionStatus;
  mcpStatus: McpStatus;
  mcpError: string | null;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
