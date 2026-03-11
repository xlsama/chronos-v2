import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { client, unwrap } from '@/lib/api'
import type { KbProject, KbDocument } from '@chronos/shared'

export const kbQueries = {
  projects: () => ['kb-projects'] as const,
  projectList: () =>
    queryOptions({
      queryKey: kbQueries.projects(),
      queryFn: () => unwrap<{ data: KbProject[] }>(client.api.kb.projects.$get()),
    }),
  projectDetail: (id: string) =>
    queryOptions({
      queryKey: [...kbQueries.projects(), id],
      queryFn: () => unwrap<{ data: KbProject }>(client.api.kb.projects[':id'].$get({ param: { id } })),
    }),
  documents: (projectId: string) => ['kb-documents', projectId] as const,
  documentList: (projectId: string) =>
    queryOptions({
      queryKey: kbQueries.documents(projectId),
      queryFn: () =>
        unwrap<{ data: KbDocument[] }>(
          client.api.kb.projects[':projectId'].documents.$get({ param: { projectId } }),
        ),
    }),
  documentDetail: (id: string) =>
    queryOptions({
      queryKey: ['kb-document', id],
      queryFn: () =>
        unwrap<{ data: KbDocument }>(client.api.kb.documents[':id'].$get({ param: { id } })),
    }),
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; tags?: string[] }) =>
      unwrap<{ data: KbProject }>(client.api.kb.projects.$post({ json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kbQueries.projects() }),
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; description: string; tags: string[] }> }) =>
      unwrap<{ data: KbProject }>(client.api.kb.projects[':id'].$put({ param: { id }, json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kbQueries.projects() }),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<{ data: KbProject }>(client.api.kb.projects[':id'].$delete({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kbQueries.projects() }),
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { projectId: string; title: string; content?: string; file?: File }) => {
      if (data.file) {
        const formData = new FormData()
        formData.append('file', data.file)
        formData.append('title', data.title)
        const res = await fetch(`/api/kb/projects/${data.projectId}/documents`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error(`API error ${res.status}`)
        const json = await res.json() as { data: KbDocument }
        return json.data
      }
      const res = await fetch(`/api/kb/projects/${data.projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.title, content: data.content ?? '' }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const json = await res.json() as { data: KbDocument }
      return json.data
    },
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: kbQueries.documents(vars.projectId) }),
  })
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ title: string; content: string }> }) =>
      unwrap<{ data: KbDocument }>(client.api.kb.documents[':id'].$put({ param: { id }, json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-documents'] }),
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<{ data: KbDocument }>(client.api.kb.documents[':id'].$delete({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-documents'] }),
  })
}

export function useReprocessDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(client.api.kb.documents[':id'].reprocess.$post({ param: { id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kb-documents'] }),
  })
}
