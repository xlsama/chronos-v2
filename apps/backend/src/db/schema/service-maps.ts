import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export interface ServiceMapGraph {
  nodes: Array<{
    id: string
    type?: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    label?: string
    data?: Record<string, unknown>
  }>
}

export const serviceMaps = pgTable('service_maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  graph: jsonb('graph').notNull().$type<ServiceMapGraph>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
})
