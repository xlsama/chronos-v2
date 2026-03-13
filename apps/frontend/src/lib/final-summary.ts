import type { Incident, IncidentFinalSummaryMetadata } from "@chronos/shared";

export function getIncidentFinalSummaryMetadata(
  incident?: Pick<Incident, "metadata"> | null,
): IncidentFinalSummaryMetadata | null {
  const value = incident?.metadata?.finalSummary;
  if (!value) return null;
  if (value.status !== "generated" && value.status !== "saved") return null;
  if (typeof value.generatedAt !== "string" || value.generatedAt.length === 0) return null;
  if (value.source !== "summarize-agent") return null;
  if (value.savedAt !== undefined && typeof value.savedAt !== "string") return null;
  if (value.documentId !== undefined && typeof value.documentId !== "string") return null;
  return value;
}

export function isIncidentFinalSummarySaved(
  incident?: Pick<Incident, "metadata"> | null,
) {
  return Boolean(getIncidentFinalSummaryMetadata(incident)?.documentId);
}
