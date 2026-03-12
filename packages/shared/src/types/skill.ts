export interface SkillToolDefinition {
  key: string;
  label?: string;
  toolName: string;
  approvalMode: "auto" | "manual";
  riskLevel: "none" | "low" | "medium" | "high";
  allowedServiceTypes: string[];
  notes?: string;
  input?: Record<string, unknown>;
}

export interface SkillRecord {
  name: string;
  slug: string;
  description?: string;
  applicableServiceTypes: string[];
  prompt?: string;
  mcpServers: string[];
  tools: SkillToolDefinition[];
  markdown: string;
}
