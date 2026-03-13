import { rmSync } from 'node:fs'
import { join } from 'node:path'

const SKILLS_ROOT = join(import.meta.dirname, '../../apps/backend/data/skills')

/**
 * @deprecated Skill config is now stored in SKILL.md frontmatter.
 * Use the createSkill API with mcpServers/applicableServiceTypes in frontmatter instead.
 */
export function writeSkillConfig(_skillSlug: string, _config: object): void {
  // No-op: config is now embedded in SKILL.md frontmatter
}

export function removeSkillConfig(skillSlug: string): void {
  const dir = join(SKILLS_ROOT, skillSlug)
  try {
    rmSync(dir, { recursive: true, force: true })
    console.log(`  [skill] config removed: ${dir}`)
  } catch {
    // ignore
  }
}
