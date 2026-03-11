import { Agent } from '@mastra/core/agent'
import { env } from '../../env'
import { searchKnowledge, getKnowledgeDocument } from '../tools/knowledge-base-tools'
import { getServiceContext } from '../tools/service-map-tools'
import { KB_AGENT_PROMPT } from './prompts/kb-agent-prompt'

export const kbAgent = new Agent({
  id: 'kb-agent',
  name: 'Knowledge Base Agent',
  description: `搜索向量知识库，识别事件所属的项目和系统，获取服务架构上下文。
返回：识别到的项目、受影响的服务（含 MCP 工具前缀）、架构摘要、上下游依赖关系。
委派此 Agent 时，请在提示中包含事件的关键错误信息和上下文。`,
  instructions: KB_AGENT_PROMPT,
  model: {
    id: `openai/${env.OPENAI_MODEL_MINI}`,
    ...(env.OPENAI_BASE_URL && { url: env.OPENAI_BASE_URL }),
    apiKey: env.OPENAI_API_KEY,
  },
  tools: { searchKnowledge, getKnowledgeDocument, getServiceContext },
})
