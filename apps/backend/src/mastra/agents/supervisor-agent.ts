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

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL });

export function createSupervisorAgent(context?: {
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
