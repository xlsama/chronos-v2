import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'

export const runbookQueries = {
  all: () => ['runbooks'] as const,
  list: () =>
    queryOptions({
      queryKey: runbookQueries.all(),
      queryFn: () => unwrap(client.api.runbooks.$get()),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...runbookQueries.all(), id],
      queryFn: () => unwrap(client.api.runbooks[':id'].$get({ param: { id } })),
    }),
}

export function useCreateRunbook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; content?: string; tags?: string[] }) =>
      unwrap(client.api.runbooks.$post({ json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runbookQueries.all() }),
  })
}

export function useUpdateRunbook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ title: string; content: string; tags: string[] }> }) =>
      unwrap(client.api.runbooks[':id'].$put({ param: { id }, json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runbookQueries.all() }),
  })
}

export function useDeleteRunbook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(client.api.runbooks[':id'].$delete({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runbookQueries.all() }),
  })
}
