import { useCallback, useState } from 'react'
import type { Attachment } from '@chronos/shared'

export type AttachmentItem =
  | { id: string; file: File; previewUrl: string | null; status: 'uploading' }
  | { id: string; file: File; previewUrl: string | null; status: 'done'; attachment: Attachment }
  | { id: string; file: File; previewUrl: string | null; status: 'error'; error: string }

let counter = 0

export function useFileUpload() {
  const [items, setItems] = useState<AttachmentItem[]>([])

  const addFiles = useCallback((files: File[]) => {
    const newItems: AttachmentItem[] = files.map((file) => {
      const id = `upload-${++counter}`
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      return { id, file, previewUrl, status: 'uploading' as const }
    })

    setItems((prev) => [...prev, ...newItems])

    for (const item of newItems) {
      const formData = new FormData()
      formData.append('file', item.file)

      fetch('/api/upload', { method: 'POST', body: formData })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
          const json = (await res.json()) as { url: string; name: string; mimeType: string }
          const attachment: Attachment = {
            type: item.file.type.startsWith('image/') ? 'image' : 'file',
            url: json.url,
            name: json.name,
            mimeType: json.mimeType,
          }
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: 'done', attachment } : i)),
          )
        })
        .catch((err: Error) => {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, status: 'error', error: err.message } : i)),
          )
        })
    }
  }, [])

  const removeFile = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const getAttachments = useCallback((): Attachment[] => {
    return items
      .filter((i): i is Extract<AttachmentItem, { status: 'done' }> => i.status === 'done')
      .map((i) => i.attachment)
  }, [items])

  const reset = useCallback(() => {
    for (const item of items) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
    setItems([])
  }, [items])

  const isUploading = items.some((i) => i.status === 'uploading')

  return { items, addFiles, removeFile, getAttachments, reset, isUploading }
}
