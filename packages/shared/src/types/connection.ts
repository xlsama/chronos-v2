import type { ConnectionStatus, ConnectionType } from "./enums";

export interface Connection {
  id: string;
  name: string;
  type: ConnectionType;
  config: string;
  status: ConnectionStatus;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
