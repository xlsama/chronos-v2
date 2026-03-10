import type { UserContent } from 'ai'
import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../env'
import { logger } from './logger'

type Attachment = { type: 'image' | 'file'; url: string; name: string; mimeType: string }

export async function readLocalFile(url: string): Promise<Buffer> {
  const uploadDir = path.resolve(env.UPLOAD_DIR)
  const filePath = path.join(uploadDir, path.basename(url))
  return fs.readFile(filePath) as Promise<Buffer>
}

export async function buildMultimodalParts(
  content: string,
  attachments: Attachment[] | null,
): Promise<string | UserContent> {
  if (!attachments || attachments.length === 0) {
    return content
  }

  const parts: UserContent = [{ type: 'text', text: content }]

  for (const attachment of attachments) {
    if (attachment.type === 'image') {
      try {
        const imageData = await readLocalFile(attachment.url)
        parts.push({
          type: 'image',
          image: imageData.toString('base64'),
          mediaType: attachment.mimeType,
        })
      } catch (err) {
        logger.warn({ err, url: attachment.url }, 'Failed to read image attachment, including as text reference')
        parts.push({ type: 'text', text: `[附件图片: ${attachment.name} (${attachment.url}) - 无法读取]` })
      }
    } else {
      try {
        const fileData = await readLocalFile(attachment.url)
        const textContent = fileData.toString('utf-8')
        parts.push({ type: 'text', text: `\n--- 附件: ${attachment.name} ---\n${textContent}\n--- 附件结束 ---` })
      } catch (err) {
        logger.warn({ err, url: attachment.url }, 'Failed to read file attachment')
        parts.push({ type: 'text', text: `[附件文件: ${attachment.name} (${attachment.url}) - 无法读取]` })
      }
    }
  }

  return parts
}
