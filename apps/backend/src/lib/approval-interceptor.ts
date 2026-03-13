import { agentContextStorage } from './agent-context'
import { evaluatePolicy, type PolicyDecision } from './tool-policy'
import { toolApprovalService } from '../services/tool-approval.service'
import { logger } from './logger'

/**
 * Check if a tool call needs approval. If so, create an approval record,
 * wait for human resolution, and return the decision.
 *
 * Returns null if no approval is needed (proceed with execution).
 * Returns 'approved' if the user approved.
 * Returns 'declined' with a message if the user declined.
 */
export async function checkApproval(
  toolName: string,
  args: Record<string, unknown>,
  context?: { skillRiskLevel?: string },
): Promise<{ action: 'proceed' } | { action: 'declined'; message: string }> {
  const policy = evaluatePolicy(toolName, args, context)

  logger.debug(
    { toolName, needsApproval: policy.needsApproval, riskLevel: policy.riskLevel, reason: policy.reason },
    '[Approval] policy evaluated',
  )

  if (!policy.needsApproval) {
    return { action: 'proceed' }
  }

  const agentCtx = agentContextStorage.getStore()
  if (!agentCtx) {
    // No agent context (shouldn't happen in normal flow), skip approval
    logger.warn({ toolName }, '[Approval] no agent context found, skipping approval check')
    return { action: 'proceed' }
  }

  // 后台模式自动审批（无人在线，阻塞等待无意义）
  if (agentCtx.isBackground) {
    logger.info(
      { toolName, riskLevel: policy.riskLevel, reason: policy.reason },
      '[Approval] auto-approved (background mode)',
    )
    return { action: 'proceed' }
  }

  const approval = await toolApprovalService.create({
    threadId: agentCtx.threadId,
    incidentId: agentCtx.incidentId,
    toolName,
    toolArgs: args,
    riskLevel: policy.riskLevel as 'low' | 'medium' | 'high',
    reason: policy.reason,
  })

  logger.info(
    { approvalId: approval.id, threadId: agentCtx.threadId, toolName, riskLevel: policy.riskLevel },
    '[Approval] waiting for human resolution',
  )

  const action = await toolApprovalService.waitForResolution(approval.id)

  if (action === 'approve') {
    logger.info({ approvalId: approval.id, toolName }, '[Approval] approved, proceeding')
    return { action: 'proceed' }
  }

  logger.info({ approvalId: approval.id, toolName }, '[Approval] declined by user')
  return {
    action: 'declined',
    message: `用户拒绝了此操作: ${policy.reason ?? toolName}`,
  }
}
