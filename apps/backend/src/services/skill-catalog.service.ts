import fs from 'node:fs/promises'
import path from 'node:path'
import { getSkillsRoot, slugifySegment } from '../lib/file-storage'

export interface SkillToolDefinition {
  key: string
  label?: string
  toolName: string
  approvalMode: 'auto' | 'manual'
  riskLevel: 'none' | 'low' | 'medium' | 'high'
  allowedServiceTypes: string[]
  notes?: string
  input?: Record<string, unknown>
}

export interface SkillDefinition {
  name: string
  slug: string
  description?: string
  applicableServiceTypes: string[]
  prompt?: string
  mcpServers: string[]
  tools: SkillToolDefinition[]
}

export interface SkillRecord extends SkillDefinition {
  markdown: string
}

async function readSkill(slug: string): Promise<SkillRecord | null> {
  const skillDir = path.join(getSkillsRoot(), slug)
  const configPath = path.join(skillDir, 'skill.config.json')
  const markdownPath = path.join(skillDir, 'skill.md')

  try {
    const [configText, markdown] = await Promise.all([
      fs.readFile(configPath, 'utf-8'),
      fs.readFile(markdownPath, 'utf-8'),
    ])

    const config = JSON.parse(configText) as SkillDefinition
    return {
      ...config,
      slug,
      applicableServiceTypes: config.applicableServiceTypes ?? [],
      mcpServers: config.mcpServers ?? [],
      tools: (config.tools ?? []).map((tool) => ({
        ...tool,
        allowedServiceTypes: tool.allowedServiceTypes ?? [],
      })),
      markdown,
    }
  } catch {
    return null
  }
}

async function writeSkill(record: SkillRecord) {
  const skillDir = path.join(getSkillsRoot(), record.slug)
  await fs.mkdir(skillDir, { recursive: true })
  const config: SkillDefinition = {
    name: record.name,
    slug: record.slug,
    description: record.description,
    applicableServiceTypes: record.applicableServiceTypes,
    prompt: record.prompt,
    mcpServers: record.mcpServers,
    tools: record.tools.map((tool) => ({
      ...tool,
      allowedServiceTypes: tool.allowedServiceTypes ?? [],
    })),
  }

  await Promise.all([
    fs.writeFile(path.join(skillDir, 'skill.md'), record.markdown, 'utf-8'),
    fs.writeFile(path.join(skillDir, 'skill.config.json'), JSON.stringify(config, null, 2), 'utf-8'),
  ])

  return record
}

export const skillCatalogService = {
  async list() {
    const root = getSkillsRoot()
    await fs.mkdir(root, { recursive: true })
    const entries = await fs.readdir(root, { withFileTypes: true })
    const skills = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => readSkill(entry.name)))
    return skills.filter((skill): skill is SkillRecord => skill !== null)
  },

  async getBySlug(slug: string) {
    return readSkill(slug)
  },

  async create(input: {
    name: string
    description?: string
    markdown: string
    config?: Partial<SkillDefinition>
  }) {
    const slug = slugifySegment(input.config?.slug || input.name)
    return writeSkill({
      name: input.name,
      slug,
      description: input.description ?? input.config?.description,
      prompt: input.config?.prompt,
      applicableServiceTypes: input.config?.applicableServiceTypes ?? [],
      mcpServers: input.config?.mcpServers ?? [],
      tools: (input.config?.tools ?? []).map((tool) => ({
        ...tool,
        allowedServiceTypes: tool.allowedServiceTypes ?? [],
      })),
      markdown: input.markdown,
    })
  },

  async update(slug: string, input: {
    name?: string
    description?: string
    markdown?: string
    config?: Partial<SkillDefinition>
  }) {
    const existing = await readSkill(slug)
    if (!existing) return null

    return writeSkill({
      name: input.name ?? existing.name,
      slug,
      description: input.description ?? input.config?.description ?? existing.description,
      prompt: input.config?.prompt ?? existing.prompt,
      applicableServiceTypes: input.config?.applicableServiceTypes ?? existing.applicableServiceTypes,
      mcpServers: input.config?.mcpServers ?? existing.mcpServers,
      tools: (input.config?.tools ?? existing.tools).map((tool) => ({
        ...tool,
        allowedServiceTypes: tool.allowedServiceTypes ?? [],
      })),
      markdown: input.markdown ?? existing.markdown,
    })
  },

  async delete(slug: string) {
    const existing = await readSkill(slug)
    if (!existing) return null
    await fs.rm(path.join(getSkillsRoot(), slug), { recursive: true, force: true })
    return existing
  },
}
