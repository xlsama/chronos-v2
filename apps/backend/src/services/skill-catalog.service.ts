import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { getSkillsRoot, slugifySegment } from '../lib/file-storage'

export interface SkillRecord {
  name: string
  slug: string
  description?: string
  markdown: string
}

async function readSkill(slug: string): Promise<SkillRecord | null> {
  const skillDir = path.join(getSkillsRoot(), slug)
  const markdownPath = path.join(skillDir, 'skill.md')
  const configPath = path.join(skillDir, 'skill.config.json')

  try {
    const raw = await fs.readFile(markdownPath, 'utf-8')
    const { data: frontmatter } = matter(raw)

    if (frontmatter.name) {
      return {
        name: frontmatter.name,
        slug,
        description: frontmatter.description,
        markdown: raw,
      }
    }

    // Fallback: no frontmatter but has skill.config.json (old format)
    try {
      const configText = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configText)
      // Reconstruct with frontmatter prepended
      const fm = [
        '---',
        `name: "${config.name}"`,
        ...(config.description ? [`description: "${config.description}"`] : []),
        '---',
        '',
      ].join('\n')
      return {
        name: config.name,
        slug,
        description: config.description,
        markdown: fm + raw,
      }
    } catch {
      // No config either, use slug as name
      return {
        name: slug,
        slug,
        markdown: raw,
      }
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
