export interface SkillRecord {
  name: string
  slug: string
  description?: string
  mcpServers?: string[]
  applicableServiceTypes?: string[]
  riskLevel?: string
  markdown: string
}
