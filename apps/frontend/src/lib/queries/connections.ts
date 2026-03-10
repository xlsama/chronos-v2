import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Connection } from '@chronos/shared'
import { api } from '@/lib/api'
import type { ConnectionFormValues } from '@/lib/schemas/connection'

export const connectionQueries = {
  all: () => ['connections'] as const,
  list: () =>
    queryOptions({
      queryKey: connectionQueries.all(),
      queryFn: () => api<Connection[]>('/connections'),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...connectionQueries.all(), id],
      queryFn: () => api<Connection>(`/connections/${id}`),
    }),
}

export function useCreateConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ConnectionFormValues) =>
      api<Connection>('/connections', { method: 'POST', body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}

export function useUpdateConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ConnectionFormValues> }) =>
      api<Connection>(`/connections/${id}`, { method: 'PUT', body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}

export function useDeleteConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/connections/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}

export function useTestConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ status: string }>(`/connections/${id}/test`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}
