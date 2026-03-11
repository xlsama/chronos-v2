import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'
import type { ConnectionFormValues } from '@/lib/schemas/connection'
import type {
  ConnectionImportCandidate,
  ConnectionImportCommitResponse,
  ConnectionImportPreviewResponse,
  ConnectionType,
} from '@chronos/shared'

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
    meta: { skipGlobalErrorToast: true },
    mutationFn: (id: string) =>
      unwrap(client.api.connections[':id'].test.$post({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}

export function useTestConnectionDirect() {
  return useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (data: { type: ConnectionType; config: Record<string, unknown> }) =>
      unwrap(client.api.connections.test.$post({ json: data })),
  })
}

export function usePreviewConnectionsFromKb() {
  return useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (data: { kbProjectId: string }) =>
      unwrap<{ data: ConnectionImportPreviewResponse }>(
        client.api.connections['import-from-kb'].preview.$post({ json: data }),
      ),
  })
}

export function useCommitConnectionsFromKb() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (data: {
      kbProjectId: string
      imports: ConnectionImportCandidate[]
      selectedIds: string[]
    }) =>
      unwrap<{ data: ConnectionImportCommitResponse }>(
        client.api.connections['import-from-kb'].commit.$post({ json: data }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: connectionQueries.all() }),
  })
}
