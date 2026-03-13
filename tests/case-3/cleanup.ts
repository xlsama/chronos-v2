import { deleteProject } from '../helpers/chronos-api'
import type { SeedResult } from './seed'

export async function cleanup(meta?: Partial<SeedResult>): Promise<void> {
  if (meta?.projectId) {
    console.log(`  [cleanup] 删除项目: ${meta.projectId}`)
    await deleteProject(meta.projectId)
  }
}
