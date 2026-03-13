import { Hono } from 'hono'
import { createOpenAI } from '@ai-sdk/openai'
import { experimental_transcribe as transcribe } from 'ai'
import { env } from '../env'
import { logger } from '../lib/logger'

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })

export const speechToTextRoutes = new Hono()
  .post('/speech-to-text', async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) {
      return c.json({ error: 'No audio file provided' }, 400)
    }

    try {
      const result = await transcribe({
        model: openai.transcription(env.OPENAI_ASR_MODEL),
        audio: Buffer.from(await file.arrayBuffer()),
      })

      return c.json({ text: result.text })
    } catch (err) {
      logger.error({ err }, 'Speech-to-text failed, falling back to direct API call')

      // Fallback: direct API call to DashScope-compatible endpoint
      const baseURL = env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
      const formData = new FormData()
      formData.append('file', file)
      formData.append('model', env.OPENAI_ASR_MODEL)

      const res = await fetch(`${baseURL}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: formData,
      })

      if (!res.ok) {
        const detail = await res.text()
        logger.error({ status: res.status, detail }, 'Direct ASR API call failed')
        return c.json({ error: 'Speech-to-text failed' }, 500)
      }

      const data = await res.json() as { text: string }
      return c.json({ text: data.text })
    }
  })
