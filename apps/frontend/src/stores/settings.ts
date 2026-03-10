import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  feishu: {
    webhookUrl: string
    signKey: string
  }
  setFeishu: (feishu: Partial<SettingsState['feishu']>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      feishu: {
        webhookUrl: '',
        signKey: '',
      },
      setFeishu: (feishu) =>
        set((state) => ({ feishu: { ...state.feishu, ...feishu } })),
    }),
    { name: 'chronos-settings' },
  ),
)
