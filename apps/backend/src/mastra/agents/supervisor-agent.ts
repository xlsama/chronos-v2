import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { env } from "../../env";
import {
  updateIncidentStatus,
  listProjectServices,
  getServiceDetails,
  getServiceMap,
} from "../tools";
import { knowledgeAgent } from "./knowledge-agent";
import { runbookAgent } from "./runbook-agent";
import { incidentHistoryAgent } from "./incident-history-agent";
import { executionAgent } from "./execution-agent";
import { buildSupervisorPrompt } from "./prompts/supervisor-prompt";
import { mastra } from "../index";
import { skillCatalogService } from "../../services/skill-catalog.service";
import { logger } from "../../lib/logger";

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL });

export async function createSupervisorAgent(context?: {
  incidentId?: string;
  incidentContent?: string;
  incidentSummary?: string;
  analysis?: Record<string, unknown>;
  selectedSkills?: string[];
  projectId?: string;
  projectName?: string;
}) {
  // Layer 1: 获取所有可用 Skill 摘要
  let skillSummaries: Array<{ slug: string; name: string; description?: string; riskLevel?: string }> = [];
  try {
    const skills = await skillCatalogService.list();
    skillSummaries = skills.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      riskLevel: s.riskLevel,
    }));
  } catch (err) {
    logger.warn({ err }, '[Supervisor] failed to load skill catalog for prompt injection');
  }

  return new Agent({
    id: "supervisorAgent",
    name: "Supervisor Agent",
    instructions: buildSupervisorPrompt(context, skillSummaries),
    model: openai.chat(env.OPENAI_MODEL),
    tools: {
      updateIncidentStatus,
      listProjectServices,
      getServiceDetails,
      getServiceMap,
    },
    agents: { knowledgeAgent, runbookAgent, incidentHistoryAgent, executionAgent },
    memory: new Memory({ storage: mastra.getStorage() }),
  });
}
