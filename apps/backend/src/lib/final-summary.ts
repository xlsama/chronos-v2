export type FinalSummaryStatus = 'generated' | 'saved'

export interface FinalSummaryMetadata {
  status: FinalSummaryStatus
  generatedAt: string
  savedAt?: string
  documentId?: string
  source: 'summarize-agent'
}

export interface SummaryToolTrace {
  toolName: string
  args?: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getFinalSummaryMetadata(
  metadata?: Record<string, unknown> | null,
): FinalSummaryMetadata | null {
  if (!isRecord(metadata?.finalSummary)) return null

  const value = metadata.finalSummary
  const { status, generatedAt, savedAt, documentId, source } = value
  if (status !== 'generated' && status !== 'saved') return null
  if (typeof generatedAt !== 'string' || generatedAt.length === 0) return null
  if (source !== 'summarize-agent') return null
  if (savedAt !== undefined && typeof savedAt !== 'string') return null
  if (documentId !== undefined && typeof documentId !== 'string') return null

  return {
    status,
    generatedAt,
    source,
    ...(savedAt ? { savedAt } : {}),
    ...(documentId ? { documentId } : {}),
  }
}

export function mergeFinalSummaryMetadata(
  metadata: Record<string, unknown> | null | undefined,
  finalSummary: FinalSummaryMetadata,
) {
  return {
    ...(metadata ?? {}),
    finalSummary,
  }
}

export function isFinalSummarySaved(metadata?: Record<string, unknown> | null) {
  return Boolean(getFinalSummaryMetadata(metadata)?.documentId)
}
