import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { env } from "../../env";
import {
  updateIncidentStatus,
  searchKnowledgeBase,
  getKnowledgeDocument,
  listSkills,
  loadSkill,
  activateSkillMcp,
  executeMcpTool,
  deactivateSkillMcp,
  runContainerCommand,
  listProjectServices,
  getServiceDetails,
  getServiceMap,
  searchRunbooks,
  getRunbook,
  searchIncidentHistory,
  getIncidentHistoryDetail,
  createRunbook,
} from "../tools";
import { knowledgeAgent } from "./knowledge-agent";
import { runbookAgent } from "./runbook-agent";
import { incidentHistoryAgent } from "./incident-history-agent";
import { buildSupervisorPrompt } from "./prompts/supervisor-prompt";
import { mastra } from "../index";

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL });

export function createSupervisorAgent(context?: {
  automationMode?: 'background' | 'interactive';
  incidentId?: string;
  incidentContent?: string;
  incidentSummary?: string;
  analysis?: Record<string, unknown>;
  selectedSkills?: string[];
  projectId?: string;
  projectName?: string;
}) {
  return new Agent({
    id: "supervisorAgent",
    name: "Supervisor Agent",
    instructions: buildSupervisorPrompt(context),
    model: openai.chat(env.OPENAI_MODEL),
    tools: context?.automationMode === 'background'
      ? {
          updateIncidentStatus,
          listSkills,
          loadSkill,
          activateSkillMcp,
          executeMcpTool,
          deactivateSkillMcp,
          runContainerCommand,
          listProjectServices,
          getServiceDetails,
          getServiceMap,
          createRunbook,
        }
      : {
          updateIncidentStatus,
          searchKnowledgeBase,
          getKnowledgeDocument,
          searchRunbooks,
          getRunbook,
          searchIncidentHistory,
          getIncidentHistoryDetail,
          listSkills,
          loadSkill,
          activateSkillMcp,
          executeMcpTool,
          deactivateSkillMcp,
          runContainerCommand,
          listProjectServices,
          getServiceDetails,
          getServiceMap,
          createRunbook,
        },
    ...(context?.automationMode === 'background'
      ? {}
      : { agents: { knowledgeAgent, runbookAgent, incidentHistoryAgent } }),
    memory: new Memory({ storage: mastra.getStorage() }),
  });
}
