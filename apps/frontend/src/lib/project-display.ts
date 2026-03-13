import type { Project } from '@chronos/shared'

const GLOBAL_PROJECT_SLUG = '_global'
const LEGACY_GLOBAL_PROJECT_NAME = 'Global'

export const GLOBAL_PROJECT_DISPLAY_NAME = '全局'

type ProjectLike = Pick<Project, 'name' | 'slug'> | null | undefined

export function getProjectDisplayName(project: ProjectLike, fallback?: string) {
  if (!project) return fallback ?? '项目'

  if (project.slug === GLOBAL_PROJECT_SLUG || project.name === LEGACY_GLOBAL_PROJECT_NAME) {
    return GLOBAL_PROJECT_DISPLAY_NAME
  }

  return project.name || fallback || '项目'
}
