import { Hono } from 'hono'
import { env } from '../env'
import path from 'node:path'
import fs from 'node:fs/promises'

const uploadDir = path.resolve(env.UPLOAD_DIR)

// Ensure upload directory exists
fs.mkdir(uploadDir, { recursive: true })

export const uploadRoutes = new Hono()
  .post('/upload', async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) {
      return c.json({ error: 'No file provided' }, 400)
    }

    const ext = path.extname(file.name) || ''
    const filename = `${crypto.randomUUID()}${ext}`
    const filepath = path.join(uploadDir, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filepath, buffer)

    return c.json({
      url: `/uploads/${filename}`,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
    })
  })
