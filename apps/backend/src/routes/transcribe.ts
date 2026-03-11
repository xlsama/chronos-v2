import { Hono } from 'hono'
import { ofetch } from 'ofetch'
import { env } from '../env'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export const transcribeRoutes = new Hono()
  .post('/transcribe', async (c) => {
    const body = await c.req.parseBody()
    const file = body['audio']
    if (!(file instanceof File)) {
      return c.json({ error: 'No audio file provided' }, 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File too large (max 100MB)' }, 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'audio/webm'

    const result = await ofetch<{ choices: { message: { content: string } }[] }>(
      `${env.OPENAI_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: {
          model: env.OPENAI_ASR_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_audio',
                  input_audio: { data: `data:${mimeType};base64,${base64}` },
                },
              ],
            },
          ],
        },
      },
    ).catch((err) => {
      throw new Error(`DashScope ASR failed: ${err.message}`)
    })

    const text = result.choices?.[0]?.message?.content ?? ''
    return c.json({ text })
  })
