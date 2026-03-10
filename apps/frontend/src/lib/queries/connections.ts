import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'
import type { ConnectionFormValues } from '@/lib/schemas/connection'

export const connectionQueries = {
  all: () => ['connections'] as const,
  list: () =>
    queryOptions({
      queryKey: connectionQueries.all(),
      queryFn: () => unwrap(client.api.connections.$get()),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...connectionQueries.all(), id],
      queryFn: () => unwrap(client.api.connections[':id'].$get({ param: { id } })),
    }),
}

export function useCreateConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ConnectionFormValues) =>
      unwrap(client.api.connections.$post({ json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}

export function useUpdateConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ConnectionFormValues> }) =>
      unwrap(client.api.connections[':id'].$put({ param: { id }, json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}

export function useDeleteConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(client.api.connections[':id'].$delete({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}

export function useTestConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(client.api.connections[':id'].test.$post({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}

export function useTestConnectionDirect() {
  return useMutation({
    mutationFn: (data: { type: string; config: Record<string, unknown> }) =>
      unwrap(client.api.connections.test.$post({ json: data as any })),
  })
}
