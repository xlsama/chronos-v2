import { hc } from 'hono/client'
import type { AppType } from '@chronos/backend/types'

export const client = hc<AppType>('/')

export async function unwrap<T extends { data: unknown }>(
  responsePromise: Promise<Response>,
): Promise<T['data']> {
  const res = await responsePromise
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (typeof body.error === 'string') {
        message = body.error
      } else if (body.error?.issues) {
        message = body.error.issues.map((i: { message: string }) => i.message).join('; ')
      }
    } catch {}
    throw new Error(message)
  }
  const json = (await res.json()) as T
  return json.data
}
