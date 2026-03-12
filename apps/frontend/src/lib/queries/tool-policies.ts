import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'
import type { ToolPolicy } from '@chronos/shared'

export const toolPolicyQueries = {
  all: () => ['tool-policies'] as const,
  global: () =>
    queryOptions({
      queryKey: toolPolicyQueries.all(),
      queryFn: () => unwrap<{ data: ToolPolicy }>(client.api['tool-policies'].$get()),
    }),
}

export function useUpdateToolPolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Omit<ToolPolicy, 'id'>>) =>
      unwrap(client.api['tool-policies'].$put({ json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: toolPolicyQueries.all() }),
  })
}
