const API_URL = process.env.CHRONOS_API_URL ?? 'http://localhost:8000'

async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${init?.method ?? 'GET'} ${path} failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Projects ──

export async function createProject(input: { name: string; description: string; tags?: string[] }) {
  const resp = await request<{ data: { id: string } }>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return resp.data
}

export async function deleteProject(projectId: string) {
  await fetch(`${API_URL}/api/projects/${projectId}`, { method: 'DELETE' }).catch(() => {})
}

// ── Services ──

export async function addService(projectId: string, input: {
  name: string
  type: string
  description?: string
  config: Record<string, unknown>
  metadata?: Record<string, unknown>
}) {
  const resp = await request<{ data: { id: string } }>(`/api/projects/${projectId}/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return resp.data
}

// ── Knowledge ──

export async function uploadKnowledge(projectId: string, opts: {
  filePath: string
  title: string
  tags: string
  description: string
}) {
  const { readFile } = await import('node:fs/promises')
  const { basename } = await import('node:path')

  const fileContent = await readFile(opts.filePath)
  const form = new FormData()
  form.append('file', new Blob([fileContent], { type: 'text/markdown' }), basename(opts.filePath))
  form.append('title', opts.title)
  form.append('tags', opts.tags)
  form.append('description', opts.description)

  const resp = await request<{ data: { id: string } }>(`/api/projects/${projectId}/knowledge`, {
    method: 'POST',
    body: form,
  })
  return resp.data
}

export async function waitForKnowledgeReady(projectId: string, kbId: string, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const resp = await request<{ data: Array<{ id: string; status: string }> }>(`/api/projects/${projectId}/knowledge`)
    const doc = resp.data.find((d) => d.id === kbId)
    if (doc?.status === 'ready') return
    if (doc?.status === 'error') throw new Error(`Knowledge document ${kbId} failed processing`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Knowledge document ${kbId} not ready after ${timeoutMs}ms`)
}

// ── Skills ──

export async function createSkill(markdown: string) {
  const resp = await request<{ data: { slug: string } }>('/api/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown }),
  })
  return resp.data
}

export async function deleteSkill(slug: string) {
  await fetch(`${API_URL}/api/skills/${slug}`, { method: 'DELETE' }).catch(() => {})
}

// ── Runbooks ──

export async function createRunbook(projectId: string, input: {
  title: string
  content: string
  tags?: string[]
  description?: string
  publicationStatus?: 'active' | 'draft' | 'published' | 'archived'
}) {
  const resp = await request<{ data: { id: string } }>(`/api/projects/${projectId}/runbooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return resp.data
}

// ── Alerts ──

export async function sendAlert(content: string, projectId: string) {
  const resp = await request<{ data: { id: string } }>('/api/webhooks/alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, projectId }),
  })
  return resp.data
}

// ── Incidents ──

export async function getIncident(id: string) {
  const resp = await request<{ data: { id: string; status: string; finalSummaryDraft?: string | null; [k: string]: unknown } }>(`/api/incidents/${id}`)
  return resp.data
}

export async function waitForIncidentResolution(incidentId: string, timeoutMs = 300_000): Promise<string> {
  const start = Date.now()
  let lastStatus = ''
  while (Date.now() - start < timeoutMs) {
    const incident = await getIncident(incidentId)
    if (incident.status !== lastStatus) {
      console.log(`  [${Math.round((Date.now() - start) / 1000)}s] ${lastStatus || 'initial'} → ${incident.status}`)
      lastStatus = incident.status
    }
    if (
      incident.status === 'resolved'
      || incident.status === 'summarizing'
      || incident.status === 'completed'
    ) {
      return incident.status
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error(`Incident ${incidentId} did not reach a post-diagnosis state after ${timeoutMs}ms (last: ${lastStatus})`)
}

export async function waitForIncidentFinalSummary(incidentId: string, timeoutMs = 120_000): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const incident = await getIncident(incidentId)
    if (
      incident.status === 'completed'
      && typeof incident.finalSummaryDraft === 'string'
      && incident.finalSummaryDraft.trim()
    ) {
      return incident.finalSummaryDraft
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error(`Incident ${incidentId} final summary not generated and completed after ${timeoutMs}ms`)
}

export async function saveIncidentSummary(incidentId: string) {
  const resp = await request<{ data: { id: string } }>(`/api/incidents/${incidentId}/save-summary`, {
    method: 'POST',
  })
  return resp.data
}

// ── Messages ──

export async function getMessages(threadId: string) {
  return request<Array<{ role: string; parts?: Array<{ type: string; text?: string }> }>>(`/api/chat/${threadId}/messages`)
}

export async function getFullText(threadId: string, timeoutMs = 20_000): Promise<string> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const messages = await getMessages(threadId)
    const assistantText = messages
      .filter((m) => m.role === 'assistant')
      .flatMap((m) => m.parts ?? [])
      .filter((p) => p.type === 'text' && p.text)
      .map((p) => p.text!)
      .join(' ')

    if (assistantText.trim()) {
      return messages
        .flatMap((m) => m.parts ?? [])
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text!)
        .join(' ')
    }

    await new Promise((r) => setTimeout(r, 1000))
  }

  const messages = await getMessages(threadId)
  return messages
    .flatMap((m) => m.parts ?? [])
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text!)
    .join(' ')
}

// ── Incident History ──

export async function getIncidentHistory(projectId: string) {
  const resp = await request<{ data: Array<unknown> }>(`/api/projects/${projectId}/incident-history`)
  return resp.data
}
