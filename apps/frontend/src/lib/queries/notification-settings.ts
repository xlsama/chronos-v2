import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'

interface NotificationSettings {
  id: string
  platform: string
  webhookUrl: string
  signKey: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export const notificationSettingsQueries = {
  all: () => ['notification-settings'] as const,
  detail: (platform: string) =>
    queryOptions({
      queryKey: [...notificationSettingsQueries.all(), platform] as const,
      queryFn: () => unwrap<{ data: NotificationSettings | null }>(
        client.api['notification-settings'][':platform'].$get({ param: { platform } }),
      ),
    }),
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ platform, data }: { platform: string; data: { webhookUrl: string; signKey?: string; enabled: boolean } }) =>
      unwrap<{ data: NotificationSettings }>(
        client.api['notification-settings'][':platform'].$put({ param: { platform }, json: data }),
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...notificationSettingsQueries.all(), variables.platform] })
    },
  })
}
