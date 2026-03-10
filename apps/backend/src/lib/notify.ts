import { createHmac } from 'node:crypto'
import { ofetch } from 'ofetch'
import { notificationSettingsService } from '../services/notification-settings.service'
import { logger } from './logger'

type FeishuMessageOptions = {
  webhookUrl: string
  signKey?: string | null
  body: Record<string, unknown>
}

export async function sendFeishuMessage({ webhookUrl, signKey, body }: FeishuMessageOptions) {
  if (signKey) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const stringToSign = `${timestamp}\n${signKey}`
    const sign = createHmac('sha256', stringToSign).update('').digest('base64')
    body.timestamp = timestamp
    body.sign = sign
  }

  const result = await ofetch<{ code: number; msg?: string }>(webhookUrl, {
    method: 'POST',
    body,
  })

  if (result.code !== 0) {
    throw new Error(`飞书返回错误: ${result.msg ?? `code ${result.code}`}`)
  }
}

const STATUS_LABELS: Record<string, string> = {
  new: '🆕 新告警',
  triaging: '🔍 分析中',
  in_progress: '🔧 处理中',
  waiting_human: '👤 等待人工',
  resolved: '✅ 已解决',
  closed: '🔒 已关闭',
}

const SOURCE_LABELS: Record<string, string> = {
  manual: '手动创建',
  webhook: 'Webhook',
}

type IncidentInfo = {
  id: string
  content: string
  summary?: string | null
  status: string
  source?: string | null
  createdAt: Date
}

function buildIncidentCreatedCard(incident: IncidentInfo) {
  const displayContent = incident.summary || incident.content
  const truncated = displayContent.length > 200 ? displayContent.slice(0, 200) + '...' : displayContent

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '🚨 新告警接入' },
        template: 'red',
      },
      elements: [
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**状态：**${STATUS_LABELS[incident.status] || incident.status}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**来源：**${SOURCE_LABELS[incident.source ?? ''] || incident.source || '未知'}` } },
          ],
        },
        { tag: 'div', text: { tag: 'lark_md', content: `**内容：**\n${truncated}` } },
        { tag: 'hr' },
        { tag: 'note', elements: [{ tag: 'plain_text', content: `ID: ${incident.id} | ${incident.createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` }] },
      ],
    },
  }
}

function buildStatusChangedCard(incident: IncidentInfo, oldStatus: string, newStatus: string) {
  const displayContent = incident.summary || incident.content
  const truncated = displayContent.length > 200 ? displayContent.slice(0, 200) + '...' : displayContent

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '🔄 告警状态变更' },
        template: newStatus === 'resolved' || newStatus === 'closed' ? 'green' : 'orange',
      },
      elements: [
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**原状态：**${STATUS_LABELS[oldStatus] || oldStatus}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**新状态：**${STATUS_LABELS[newStatus] || newStatus}` } },
          ],
        },
        { tag: 'div', text: { tag: 'lark_md', content: `**内容：**\n${truncated}` } },
        { tag: 'hr' },
        { tag: 'note', elements: [{ tag: 'plain_text', content: `ID: ${incident.id} | ${incident.createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` }] },
      ],
    },
  }
}

async function getFeishuSettings() {
  const settings = await notificationSettingsService.getRaw('feishu')
  if (!settings || !settings.enabled) return null
  return settings
}

export async function notifyIncidentCreated(incident: IncidentInfo) {
  try {
    const settings = await getFeishuSettings()
    if (!settings) return

    const body = buildIncidentCreatedCard(incident)
    await sendFeishuMessage({ webhookUrl: settings.webhookUrl, signKey: settings.signKey, body })
  } catch (err) {
    logger.warn({ err, incidentId: incident.id }, 'Failed to send feishu notification for incident creation')
  }
}

export async function notifyIncidentStatusChanged(incident: IncidentInfo, oldStatus: string, newStatus: string) {
  try {
    const settings = await getFeishuSettings()
    if (!settings) return

    const body = buildStatusChangedCard(incident, oldStatus, newStatus)
    await sendFeishuMessage({ webhookUrl: settings.webhookUrl, signKey: settings.signKey, body })
  } catch (err) {
    logger.warn({ err, incidentId: incident.id }, 'Failed to send feishu notification for status change')
  }
}
