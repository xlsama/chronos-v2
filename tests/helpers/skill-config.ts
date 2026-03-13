import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SKILLS_ROOT = join(import.meta.dirname, '../../apps/backend/data/skills')

export function writeSkillConfig(skillSlug: string, config: object): void {
  const dir = join(SKILLS_ROOT, skillSlug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'skill.config.json'), JSON.stringify(config, null, 2))
  console.log(`  [skill] config written: ${dir}/skill.config.json`)
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
