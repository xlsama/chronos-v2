import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../../env'
import { listSkills, loadSkill, activateSkillMcp, executeMcpTool, deactivateSkillMcp, listActiveMcps, runContainerCommand } from '../tools'
import { EXECUTION_AGENT_PROMPT } from './prompts/execution-agent-prompt'

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })

export const executionAgent = new Agent({
  id: 'executionAgent',
  name: 'Execution Agent',
  description: '技能执行 Agent - 加载 Skill、激活 MCP、执行诊断查询、返回结果',
  instructions: EXECUTION_AGENT_PROMPT,
  model: openai.chat(env.OPENAI_MODEL),
  tools: { listSkills, loadSkill, activateSkillMcp, executeMcpTool, deactivateSkillMcp, listActiveMcps, runContainerCommand },
})
