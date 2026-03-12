import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Incident, IncidentDetail, Project, ProjectDocument, ProjectService, SkillRecord } from '@chronos/shared'
import { client, unwrap } from '@/lib/api'

export type PaginatedProjectDocuments = {
  data: ProjectDocument[]
  total: number
  page: number
  pageSize: number
}

export const opsQueries = {
  projects: () => ['ops', 'projects'] as const,
  projectList: () =>
    queryOptions({
      queryKey: opsQueries.projects(),
      queryFn: () => unwrap<{ data: Project[] }>(client.api.projects.$get()),
      placeholderData: keepPreviousData,
    }),
  allDocuments: (kind: 'knowledge' | 'runbook' | 'incident_history', publicationStatus?: 'active' | 'draft' | 'published' | 'archived') =>
    queryOptions({
      queryKey: ['ops', 'documents', kind, publicationStatus] as const,
      queryFn: () => unwrap<{ data: ProjectDocument[] }>(
        client.api.projects.documents.$get({
          query: {
            kind,
            ...(publicationStatus ? { publicationStatus } : {}),
          },
        }),
      ),
      placeholderData: keepPreviousData,
    }),
  projectKnowledge: (projectId: string) =>
    queryOptions({
      queryKey: ['ops', 'projects', projectId, 'knowledge'] as const,
      queryFn: () => unwrap<{ data: ProjectDocument[] }>(
        client.api.projects[':projectId'].knowledge.$get({ param: { projectId } }),
      ),
    }),
  projectRunbooks: (
    projectId: string,
    params: {
      publicationStatus?: 'active' | 'draft' | 'published' | 'archived'
      page?: number
      pageSize?: number
    } = {},
  ) =>
    queryOptions({
      queryKey: ['ops', 'projects', projectId, 'runbooks', params] as const,
      queryFn: async () => {
        const res = await client.api.projects[':projectId'].runbooks.$get({
          param: { projectId },
          query: {
            ...(params.publicationStatus ? { publicationStatus: params.publicationStatus } : {}),
            ...(params.page ? { page: params.page } : {}),
            ...(params.pageSize ? { pageSize: params.pageSize } : {}),
          },
        })
        if (!res.ok) throw new Error(`API error ${res.status}`)
        return res.json() as Promise<PaginatedProjectDocuments>
      },
      placeholderData: keepPreviousData,
    }),
  projectHistory: (projectId: string) =>
    queryOptions({
      queryKey: ['ops', 'projects', projectId, 'incident-history'] as const,
      queryFn: () => unwrap<{ data: ProjectDocument[] }>(
        client.api.projects[':projectId']['incident-history'].$get({ param: { projectId } }),
      ),
    }),
  document: (documentId: string) =>
    queryOptions({
      queryKey: ['ops', 'documents', documentId] as const,
      queryFn: () => unwrap<{ data: ProjectDocument }>(
        client.api.projects.documents[':documentId'].$get({ param: { documentId } }),
      ),
    }),
  allServices: () =>
    queryOptions({
      queryKey: ['ops', 'services'] as const,
      queryFn: () => unwrap<{ data: ProjectService[] }>(client.api.projects.services.$get()),
      placeholderData: keepPreviousData,
    }),
  projectServices: (projectId: string) =>
    queryOptions({
      queryKey: ['ops', 'projects', projectId, 'services'] as const,
      queryFn: () => unwrap<{ data: ProjectService[] }>(
        client.api.projects[':projectId'].services.$get({ param: { projectId } }),
      ),
    }),
  serviceMapContext: (projectId: string) =>
    queryOptions({
      queryKey: ['ops', 'projects', projectId, 'service-map-context'] as const,
      queryFn: () => unwrap(
        client.api['service-map'][':projectId'].context.$get({ param: { projectId } }),
      ),
    }),
  skills: () =>
    queryOptions({
      queryKey: ['ops', 'skills'] as const,
      queryFn: () => unwrap<{ data: SkillRecord[] }>(client.api.skills.$get()),
      placeholderData: keepPreviousData,
    }),
  skill: (slug: string) =>
    queryOptions({
      queryKey: ['ops', 'skills', slug] as const,
      queryFn: () => unwrap<{ data: SkillRecord }>(client.api.skills[':slug'].$get({ param: { slug } })),
    }),
  incidents: (params: { status?: string; limit?: number; offset?: number } = {}) =>
    queryOptions({
      queryKey: ['ops', 'incidents', params] as const,
      queryFn: async () => {
        const res = await client.api.incidents.$get({ query: params })
        if (!res.ok) throw new Error(`API error ${res.status}`)
        return res.json() as Promise<{ data: Incident[]; total: number }>
      },
      placeholderData: keepPreviousData,
      refetchInterval: 5000,
    }),
  incidentDetail: (id: string) =>
    queryOptions({
      queryKey: ['ops', 'incidents', id] as const,
      queryFn: () => unwrap<{ data: IncidentDetail }>(client.api.incidents[':id'].$get({ param: { id } })),
      refetchInterval: 5000,
    }),
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string; tags?: string[]; contextSummary?: string }) =>
      unwrap<{ data: Project }>(client.api.projects.$post({ json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: opsQueries.projects() }),
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; description: string; tags: string[]; contextSummary: string }> }) =>
      unwrap<{ data: Project }>(client.api.projects[':projectId'].$put({ param: { projectId: id }, json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: opsQueries.projects() }),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<{ data: Project }>(client.api.projects[':projectId'].$delete({ param: { projectId: id } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: opsQueries.projects() }),
  })
}

export function useCreateKnowledgeDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      projectId: string
      title: string
      content?: string
      tags?: string[]
      description?: string
      file?: File
    }) => {
      if (data.file) {
        const formData = new FormData()
        formData.append('file', data.file)
        formData.append('title', data.title)
        if (data.description) formData.append('description', data.description)
        if (data.tags?.length) formData.append('tags', data.tags.join(','))

        const res = await fetch(`/api/projects/${data.projectId}/knowledge`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error((await res.json()).error ?? `API error ${res.status}`)
        return (await res.json() as { data: ProjectDocument }).data
      }

      return unwrap<{ data: ProjectDocument }>(
        client.api.projects[':projectId'].knowledge.$post({
          param: { projectId: data.projectId },
          json: {
            title: data.title,
            content: data.content ?? '',
            tags: data.tags ?? [],
            description: data.description,
          },
        }),
      )
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'projects', variables.projectId, 'knowledge'] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'documents', 'knowledge'] })
    },
  })
}

export function useCreateMarkdownDocument(kind: 'runbook' | 'incident_history') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      projectId: string
      title: string
      content: string
      tags?: string[]
      description?: string
      publicationStatus?: 'active' | 'draft' | 'published' | 'archived'
    }) => {
      const route = kind === 'runbook'
        ? client.api.projects[':projectId'].runbooks
        : client.api.projects[':projectId']['incident-history']

      return unwrap<{ data: ProjectDocument }>(route.$post({
        param: { projectId: data.projectId },
        json: data,
      }))
    },
    onSuccess: (_, variables) => {
      const resourceKey = kind === 'runbook' ? 'runbooks' : 'incident-history'
      queryClient.invalidateQueries({ queryKey: ['ops', 'projects', variables.projectId, resourceKey] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'documents', kind] })
    },
  })
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ title: string; content: string; description: string; tags: string[]; publicationStatus: 'active' | 'draft' | 'published' | 'archived' }> }) =>
      unwrap<{ data: ProjectDocument }>(client.api.projects.documents[':documentId'].$put({ param: { documentId: id }, json: data })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'documents'] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'projects'] })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<{ data: ProjectDocument }>(client.api.projects.documents[':documentId'].$delete({ param: { documentId: id } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'documents'] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'projects'] })
    },
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { projectId: string; name: string; type: ProjectService['type']; description?: string; config: Record<string, unknown>; metadata?: Record<string, unknown> }) =>
      unwrap<{ data: ProjectService }>(client.api.projects[':projectId'].services.$post({
        param: { projectId: data.projectId },
        json: {
          name: data.name,
          type: data.type,
          description: data.description,
          config: data.config,
          metadata: data.metadata,
        },
      })),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'projects', variables.projectId, 'services'] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'services'] })
    },
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; type: ProjectService['type']; description: string; config: Record<string, unknown>; metadata: Record<string, unknown> }> }) =>
      unwrap<{ data: ProjectService }>(client.api.projects.services[':serviceId'].$put({ param: { serviceId: id }, json: data })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'services'] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'projects'] })
    },
  })
}

export function useDeleteService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<{ data: ProjectService }>(client.api.projects.services[':serviceId'].$delete({ param: { serviceId: id } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'services'] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'projects'] })
    },
  })
}

export function useTestService() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { skipGlobalErrorToast: true },
    mutationFn: (id: string) =>
      unwrap<{ data: ProjectService }>(client.api.projects.services[':serviceId'].test.$post({ param: { serviceId: id } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'services'] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'projects'] })
    },
  })
}

export function useCreateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { markdown: string }) =>
      unwrap<{ data: SkillRecord }>(client.api.skills.$post({ json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ops', 'skills'] }),
  })
}

export function useUpdateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: { markdown: string } }) =>
      unwrap<{ data: SkillRecord }>(client.api.skills[':slug'].$put({ param: { slug }, json: data })),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'skills'] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'skills', variables.slug] })
    },
  })
}

export function useDeleteSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) =>
      unwrap<{ data: SkillRecord }>(client.api.skills[':slug'].$delete({ param: { slug } })),
    onSuccess: (_, slug) => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'skills'] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'skills', slug] })
    },
  })
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { content: string; projectId?: string | null; attachments?: Incident['attachments']; metadata?: Record<string, unknown> }) =>
      unwrap<{ data: Incident }>(client.api.incidents.$post({ json: data })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ops', 'incidents'] }),
  })
}

export function useSaveIncidentSummary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<{ data: ProjectDocument }>(client.api.incidents[':id']['save-summary'].$post({ param: { id } })),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['ops', 'incidents', id] })
      queryClient.invalidateQueries({ queryKey: ['ops', 'documents', 'incident_history'] })
    },
  })
}

