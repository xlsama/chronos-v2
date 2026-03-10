import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'

export const notificationSettingsQueries = {
  all: () => ['notification-settings'] as const,
  detail: (platform: string) =>
    queryOptions({
      queryKey: [...notificationSettingsQueries.all(), platform],
      queryFn: () =>
        unwrap(client.api['notification-settings'][':platform'].$get({ param: { platform } })),
    }),
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ platform, data }: { platform: string; data: { webhookUrl: string; signKey?: string; enabled?: boolean } }) =>
      unwrap(client.api['notification-settings'][':platform'].$put({ param: { platform }, json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationSettingsQueries.all() }),
  })
}

export function useDeleteNotificationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (platform: string) =>
      unwrap(client.api['notification-settings'][':platform'].$delete({ param: { platform } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationSettingsQueries.all() }),
  })
}
