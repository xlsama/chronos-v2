import { useMutation } from '@tanstack/react-query'
import { ofetch } from 'ofetch'

export function useTranscribe() {
  return useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      const res = await ofetch<{ text: string }>('/api/transcribe', {
        method: 'POST',
        body: formData,
      })
      return res.text
    },
  })
}
