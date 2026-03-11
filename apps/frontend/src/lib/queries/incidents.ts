import { queryOptions, keepPreviousData, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'
import type { Incident } from '@chronos/shared'

export const incidentQueries = {
  all: () => ['incidents'] as const,
  list: (params: { status?: string; limit?: number; offset?: number } = {}) =>
    queryOptions({
      queryKey: [...incidentQueries.all(), 'list', params],
      queryFn: async () => {
        const res = await client.api.incidents.$get({ query: params })
        if (!res.ok) throw new Error(`API error ${res.status}`)
        return res.json() as Promise<{ data: Incident[]; total: number }>
      },
      refetchInterval: 5000,
      refetchIntervalInBackground: false,
      placeholderData: keepPreviousData,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...incidentQueries.all(), id],
      queryFn: () => unwrap(client.api.incidents[':id'].$get({ param: { id } })),
    }),
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { content: string; attachments?: { type: 'image' | 'file'; url: string; name: string; mimeType: string }[]; knowledgeBaseIds?: string[] }) =>
      unwrap(client.api.incidents.$post({ json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incidentQueries.all() }),
  })
}
