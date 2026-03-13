import { deleteSkill, deleteProject } from '../helpers/chronos-api'
import { removeSkillConfig } from '../helpers/skill-config'
import type { SeedResult } from './seed'

export async function cleanup(meta: Partial<SeedResult>): Promise<void> {
  if (meta.skillSlug) {
    console.log(`  [cleanup] 删除 Skill: ${meta.skillSlug}`)
    await deleteSkill(meta.skillSlug)
    removeSkillConfig(meta.skillSlug)
  }

  if (meta.projectId) {
    console.log(`  [cleanup] 删除项目: ${meta.projectId}`)
    await deleteProject(meta.projectId)
  }
}
