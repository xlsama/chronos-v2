import { skillService } from '../services/skill.service'

export async function buildSkillsManifest(): Promise<string> {
  const skills = await skillService.list({})

  if (skills.length === 0) return ''

  const manifest = skills
    .map((s) => `- [${s.id}] ${s.name} (${s.category}): ${s.summary}`)
    .join('\n')

  return `## 可用 Skills\n以下是你掌握的运维方法论，按需使用 loadSkill 加载完整内容：\n${manifest}`
}
