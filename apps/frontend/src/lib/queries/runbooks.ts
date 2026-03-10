import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Runbook } from '@chronos/shared'
import { api } from '@/lib/api'

export const runbookQueries = {
  all: () => ['runbooks'] as const,
  list: () =>
    queryOptions({
      queryKey: runbookQueries.all(),
      queryFn: () => api<Runbook[]>('/runbooks'),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...runbookQueries.all(), id],
      queryFn: () => api<Runbook>(`/runbooks/${id}`),
    }),
}

export function useCreateRunbook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; content?: string; tags?: string[] }) =>
      api<Runbook>('/runbooks', { method: 'POST', body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runbookQueries.all() }),
  })
}

export function useUpdateRunbook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ title: string; content: string; tags: string[] }> }) =>
      api<Runbook>(`/runbooks/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runbookQueries.all() }),
  })
}

export function useDeleteRunbook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/runbooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runbookQueries.all() }),
  })
}
