import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { getSkillsRoot, slugifySegment } from '../lib/file-storage'

export interface SkillRecord {
  name: string
  slug: string
  description?: string
  mcpServers?: string[]
  applicableServiceTypes?: string[]
  riskLevel?: string
  markdown: string
}

async function readSkill(slug: string): Promise<SkillRecord | null> {
  const skillDir = path.join(getSkillsRoot(), slug)
  const markdownPath = path.join(skillDir, 'skill.md')

  try {
    const raw = await fs.readFile(markdownPath, 'utf-8')
    const { data: frontmatter } = matter(raw)

    return {
      name: frontmatter.name || slug,
      slug,
      description: frontmatter.description,
      mcpServers: frontmatter.mcpServers,
      applicableServiceTypes: frontmatter.applicableServiceTypes,
      riskLevel: frontmatter.riskLevel,
      markdown: raw,
    }
  } catch {
    return null
  }
}

async function writeSkill(record: SkillRecord) {
  const skillDir = path.join(getSkillsRoot(), record.slug)
  await fs.mkdir(skillDir, { recursive: true })
  await fs.writeFile(path.join(skillDir, 'skill.md'), record.markdown, 'utf-8')
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

  async create(input: { markdown: string }) {
    const { data: frontmatter } = matter(input.markdown)
    const name = frontmatter.name || 'Untitled Skill'
    const slug = slugifySegment(name)
    return writeSkill({
      name,
      slug,
      description: frontmatter.description,
      mcpServers: frontmatter.mcpServers,
      applicableServiceTypes: frontmatter.applicableServiceTypes,
      riskLevel: frontmatter.riskLevel,
      markdown: input.markdown,
    })
  },

  async update(slug: string, input: { markdown: string }) {
    const existing = await readSkill(slug)
    if (!existing) return null

    const { data: frontmatter } = matter(input.markdown)
    return writeSkill({
      name: frontmatter.name || existing.name,
      slug,
      description: frontmatter.description ?? existing.description,
      mcpServers: frontmatter.mcpServers ?? existing.mcpServers,
      applicableServiceTypes: frontmatter.applicableServiceTypes ?? existing.applicableServiceTypes,
      riskLevel: frontmatter.riskLevel ?? existing.riskLevel,
      markdown: input.markdown,
    })
  },

  async delete(slug: string) {
    const existing = await readSkill(slug)
    if (!existing) return null
    await fs.rm(path.join(getSkillsRoot(), slug), { recursive: true, force: true })
    return existing
  },
}
