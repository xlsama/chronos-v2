import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { connectionService } from '../../services/connection.service'

export const listConnections = createTool({
  id: 'list-connections',
  description:
    'List all available infrastructure connections (databases, caches, monitoring systems, etc.). Returns connection names, types, and status.',
  inputSchema: z.object({}),
  execute: async () => {
    const connections = await connectionService.list()
    return connections.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
    }))
  },
})
