import type { z } from 'zod'

export interface MCPTool {
  description: string
  parameters: z.ZodSchema
  execute: (input: any) => Promise<unknown>
}

export interface MCPServer {
  connectionId: string
  connectionName: string
  connectionType: string
  tools: Record<string, MCPTool>
  dispose: () => Promise<void>
}

export type MCPFactory = (connection: {
  id: string
  name: string
  config: Record<string, unknown>
}) => Promise<MCPServer>
