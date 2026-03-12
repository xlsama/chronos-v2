import { Agent } from '@mastra/core/agent'
import { createOpenAI } from '@ai-sdk/openai'
import { env } from '../../env'
import { searchKnowledgeBase, getKnowledgeDocument } from '../tools'
import { KNOWLEDGE_AGENT_PROMPT } from './prompts/knowledge-agent-prompt'

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })

export const knowledgeAgent = new Agent({
  id: 'knowledgeAgent',
  name: 'Knowledge Agent',
  description: '知识库搜索 Agent - 在项目知识库中搜索与问题相关的文档和技术资料',
  instructions: KNOWLEDGE_AGENT_PROMPT,
  model: openai.chat(env.OPENAI_MODEL_MINI),
  tools: { searchKnowledgeBase, getKnowledgeDocument },
})
