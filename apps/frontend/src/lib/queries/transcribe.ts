import { useMutation } from '@tanstack/react-query'

export function useTranscribe() {
  return useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(res.statusText)
      const json = await res.json()
      return json.text as string
    },
  })
}
