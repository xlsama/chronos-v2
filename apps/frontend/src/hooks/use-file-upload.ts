import { useState, useCallback, useRef } from 'react'
import type { Attachment } from '@chronos/shared'

export type AttachmentItem =
  | { status: 'uploading'; id: string; file: File; previewUrl?: string }
  | { status: 'done'; id: string; attachment: Attachment; previewUrl?: string }
  | { status: 'error'; id: string; file: File; error: string; previewUrl?: string }

let itemIdCounter = 0

export interface UseFileUploadReturn {
  items: AttachmentItem[]
  hasUploading: boolean
  doneAttachments: Attachment[]
  handleFilesAdded: (files: File[]) => void
  removeItem: (id: string) => void
  cleanupAll: () => void
  handlePaste: (e: React.ClipboardEvent) => void
}

export function useFileUpload(): UseFileUploadReturn {
  const [items, setItems] = useState<AttachmentItem[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items

  const uploadFile = useCallback(async (file: File) => {
    const id = `att-${++itemIdCounter}`
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined

    setItems((prev) => [...prev, { status: 'uploading', id, file, previewUrl }])

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('上传失败')
      const data = (await res.json()) as { url: string; name: string; mimeType: string }
      const type = data.mimeType.startsWith('image/') ? ('image' as const) : ('file' as const)
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { status: 'done', id, attachment: { type, url: data.url, name: data.name, mimeType: data.mimeType }, previewUrl }
            : item,
        ),
      )
    } catch (err) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { status: 'error', id, file, error: err instanceof Error ? err.message : '上传失败', previewUrl }
            : item,
        ),
      )
    }
  }, [])

  const handleFilesAdded = useCallback(
    (files: File[]) => {
      for (const file of files) {
        uploadFile(file)
      }
    },
    [uploadFile],
  )

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const cleanupAll = useCallback(() => {
    for (const item of itemsRef.current) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    }
    setItems([])
  }, [])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData.files)
      if (files.length > 0) {
        e.preventDefault()
        handleFilesAdded(files)
      }
    },
    [handleFilesAdded],
  )

  const hasUploading = items.some((i) => i.status === 'uploading')
  const doneAttachments = items
    .filter((i): i is Extract<AttachmentItem, { status: 'done' }> => i.status === 'done')
    .map((i) => i.attachment)

  return {
    items,
    hasUploading,
    doneAttachments,
    handleFilesAdded,
    removeItem,
    cleanupAll,
    handlePaste,
  }
}
