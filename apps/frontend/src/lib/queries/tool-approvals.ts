import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'
import type { ToolApproval, ApprovalStatus } from '@chronos/shared'

export const toolApprovalQueries = {
  all: () => ['tool-approvals'] as const,
  list: (filters?: { status?: ApprovalStatus; threadId?: string }) =>
    queryOptions({
      queryKey: [...toolApprovalQueries.all(), filters],
      queryFn: () =>
        unwrap<{ data: ToolApproval[] }>(
          client.api.approvals.$get({ query: filters ?? {} }),
        ),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...toolApprovalQueries.all(), id],
      queryFn: () => unwrap<{ data: ToolApproval }>(client.api.approvals[':id'].$get({ param: { id } })),
    }),
}

export function useDecideApproval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approved, reason }: { id: string; approved: boolean; reason?: string }) =>
      unwrap(client.api.approvals[':id'].decide.$post({ param: { id }, json: { approved, reason } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: toolApprovalQueries.all() }),
  })
}
