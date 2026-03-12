import fs from 'node:fs/promises'
import path from 'node:path'
import { getSkillsRoot, slugifySegment } from '../lib/file-storage'

export interface SkillRecord {
  name: string
  slug: string
  description?: string
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

    const config = JSON.parse(configText)
    return {
      name: config.name,
      slug,
      description: config.description,
      markdown,
    }
  } catch {
    return null
  }
}

async function writeSkill(record: SkillRecord) {
  const skillDir = path.join(getSkillsRoot(), record.slug)
  await fs.mkdir(skillDir, { recursive: true })

  const config = {
    name: record.name,
    slug: record.slug,
    description: record.description,
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
  }) {
    const slug = slugifySegment(input.name)
    return writeSkill({
      name: input.name,
      slug,
      description: input.description,
      markdown: input.markdown,
    })
  },

  async update(slug: string, input: {
    name?: string
    description?: string
    markdown?: string
  }) {
    const existing = await readSkill(slug)
    if (!existing) return null

    return writeSkill({
      name: input.name ?? existing.name,
      slug,
      description: input.description ?? existing.description,
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
