import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'
import type { ServiceMapGraph } from '@chronos/shared'

export const serviceMapQueries = {
  all: () => ['service-maps'] as const,
  list: () =>
    queryOptions({
      queryKey: serviceMapQueries.all(),
      queryFn: () => unwrap(client.api['service-maps'].$get()),
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: [...serviceMapQueries.all(), id],
      queryFn: () => unwrap(client.api['service-maps'][':id'].$get({ param: { id } })),
    }),
}

export function useCreateServiceMap() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; graph: ServiceMapGraph }) =>
      unwrap(client.api['service-maps'].$post({ json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceMapQueries.all() }),
  })
}

export function useUpdateServiceMap() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; graph?: ServiceMapGraph } }) =>
      unwrap(client.api['service-maps'][':id'].$put({ param: { id }, json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceMapQueries.all() }),
  })
}

export function useDeleteServiceMap() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(client.api['service-maps'][':id'].$delete({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceMapQueries.all() }),
  })
}
