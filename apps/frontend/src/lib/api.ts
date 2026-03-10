import { hc } from 'hono/client'
import type { AppType } from '@chronos/backend/types'

export const client = hc<AppType>('/')

export async function unwrap<T extends { data: unknown }>(
  responsePromise: Promise<Response>,
): Promise<T['data']> {
  const res = await responsePromise
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API error ${res.status}: ${text}`)
  }
  const json = (await res.json()) as T
  return json.data
}
