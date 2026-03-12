import { createHmac } from 'node:crypto'
import { ofetch } from 'ofetch'

export async function sendFeishuMessage({ webhookUrl, signKey, text }: {
  webhookUrl: string
  signKey?: string | null
  text: string
}) {
  const body: Record<string, unknown> = {
    msg_type: 'text',
    content: { text },
  }

  if (signKey) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const stringToSign = `${timestamp}\n${signKey}`
    const sign = createHmac('sha256', stringToSign).update('').digest('base64')
    body.timestamp = timestamp
    body.sign = sign
  }

  const result = await ofetch<{ code: number; msg: string }>(webhookUrl, {
    method: 'POST',
    body,
  })

  if (result.code !== 0) {
    throw new Error(`Feishu API error: ${result.msg}`)
  }

  return result
}
