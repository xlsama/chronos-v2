import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { getSkillsRoot, slugifySegment } from '../lib/file-storage'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'

const SKILL_MARKDOWN_FILE = 'SKILL.md'

export interface SkillRecord {
  name: string
  slug: string
  description?: string
  mcpServers?: string[]
  applicableServiceTypes?: string[]
  riskLevel?: string
  markdown: string
}

type SkillFrontmatter = {
  name: string
  description: string
  mcpServers: string[]
  applicableServiceTypes: string[]
  riskLevel: string
}

function readRequiredString(value: unknown, field: keyof SkillFrontmatter, skillRef: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(400, `Skill ${skillRef} is missing required frontmatter field "${field}"`)
  }

  return value.trim()
}

function readRequiredStringArray(value: unknown, field: keyof SkillFrontmatter, skillRef: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(400, `Skill ${skillRef} is missing required frontmatter field "${field}"`)
  }

  const normalized = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (normalized.length === 0) {
    throw new AppError(400, `Skill ${skillRef} is missing required frontmatter field "${field}"`)
  }

  return normalized
}

function parseFrontmatter(frontmatter: Record<string, unknown>, skillRef: string): SkillFrontmatter {
  return {
    name: readRequiredString(frontmatter.name, 'name', skillRef),
    description: readRequiredString(frontmatter.description, 'description', skillRef),
    mcpServers: readRequiredStringArray(frontmatter.mcpServers, 'mcpServers', skillRef),
    applicableServiceTypes: readRequiredStringArray(frontmatter.applicableServiceTypes, 'applicableServiceTypes', skillRef),
    riskLevel: readRequiredString(frontmatter.riskLevel, 'riskLevel', skillRef),
  }
}

async function readSkill(slug: string): Promise<SkillRecord | null> {
  const skillDir = path.join(getSkillsRoot(), slug)
  const markdownPath = path.join(skillDir, SKILL_MARKDOWN_FILE)

  try {
    const raw = await fs.readFile(markdownPath, 'utf-8')
    const { data: frontmatter } = matter(raw)
    const parsed = parseFrontmatter(frontmatter, slug)

    return {
      name: parsed.name,
      slug,
      description: parsed.description,
      mcpServers: parsed.mcpServers,
      applicableServiceTypes: parsed.applicableServiceTypes,
      riskLevel: parsed.riskLevel,
      markdown: raw,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }

    logger.warn(
      { err: error, skillSlug: slug, markdownFile: SKILL_MARKDOWN_FILE },
      'Skipping invalid skill definition',
    )
    return null
  }
}

async function writeSkill(record: SkillRecord) {
  const skillDir = path.join(getSkillsRoot(), record.slug)
  await fs.mkdir(skillDir, { recursive: true })
  await fs.writeFile(path.join(skillDir, SKILL_MARKDOWN_FILE), record.markdown, 'utf-8')
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
    const parsed = parseFrontmatter(frontmatter, 'new-skill')
    const name = parsed.name
    const slug = slugifySegment(name)
    return writeSkill({
      name,
      slug,
      description: parsed.description,
      mcpServers: parsed.mcpServers,
      applicableServiceTypes: parsed.applicableServiceTypes,
      riskLevel: parsed.riskLevel,
      markdown: input.markdown,
    })
  },

  async update(slug: string, input: { markdown: string }) {
    const existing = await readSkill(slug)
    if (!existing) return null

    const { data: frontmatter } = matter(input.markdown)
    const parsed = parseFrontmatter(frontmatter, slug)
    return writeSkill({
      name: parsed.name,
      slug,
      description: parsed.description,
      mcpServers: parsed.mcpServers,
      applicableServiceTypes: parsed.applicableServiceTypes,
      riskLevel: parsed.riskLevel,
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
