import { spawn } from 'node:child_process'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { checkApproval } from '../../lib/approval-interceptor'
import { logger, truncate } from '../../lib/logger'
import { getAgentLogContext, toolLogLabel } from '../../lib/agent-context'

const MAX_OUTPUT_CHARS = 12_000

function appendOutput(current: string, chunk: string) {
  const combined = current + chunk
  if (combined.length <= MAX_OUTPUT_CHARS) return combined
  return combined.slice(combined.length - MAX_OUTPUT_CHARS)
}

export const runContainerCommand = createTool({
  id: 'runContainerCommand',
  description: '在 Chronos 后端运行容器中执行非交互式 shell 命令。所有 shell 命令都需要人工审批。优先用于 MCP 不足时的只读探测、检查命令是否存在，或在说明用途后安装额外 CLI。避免长时间运行和破坏性操作。',
  inputSchema: z.object({
    command: z.string().min(1).max(4000).describe('要在容器内执行的 shell 命令，使用 /bin/sh -lc 运行'),
    timeoutMs: z.coerce.number().int().min(1_000).max(300_000).default(60_000).describe('命令超时时间（毫秒）'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    exitCode: z.number().nullable().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (input) => {
    const ctx = getAgentLogContext()
    logger.info({ ...ctx, command: truncate(input.command, 200), timeoutMs: input.timeoutMs }, toolLogLabel('runContainerCommand', 'invoked'))

    // Check approval policy
    const decision = await checkApproval('runContainerCommand', input)
    if (decision.action === 'declined') {
      logger.warn({ ...ctx }, toolLogLabel('runContainerCommand', 'declined by approval'))
      return { success: false, error: decision.message }
    }

    const timeoutMs = input.timeoutMs ?? 60_000

    return new Promise((resolve) => {
      const child = spawn('/bin/sh', ['-lc', input.command], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false
      let hardKillTimeout: NodeJS.Timeout | undefined

      child.stdout?.on('data', (chunk) => {
        stdout = appendOutput(stdout, String(chunk))
      })

      child.stderr?.on('data', (chunk) => {
        stderr = appendOutput(stderr, String(chunk))
      })

      const timeout = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
        hardKillTimeout = setTimeout(() => {
          child.kill('SIGKILL')
        }, 5_000)
      }, timeoutMs)

      child.on('error', (error) => {
        clearTimeout(timeout)
        if (hardKillTimeout) clearTimeout(hardKillTimeout)
        logger.error({ ...ctx, error: error.message }, toolLogLabel('runContainerCommand', 'spawn error'))
        resolve({
          success: false,
          stdout,
          stderr,
          error: error.message,
        })
      })

      child.on('close', (code, signal) => {
        clearTimeout(timeout)
        if (hardKillTimeout) clearTimeout(hardKillTimeout)

        if (timedOut) {
          logger.warn({ ...ctx, exitCode: code, stdoutLen: stdout.length, stderrLen: stderr.length }, toolLogLabel('runContainerCommand', 'timed out'))
          resolve({
            success: false,
            exitCode: code,
            stdout,
            stderr,
            error: `Command timed out after ${timeoutMs}ms`,
          })
          return
        }

        if (code === 0) {
          logger.info({ ...ctx, exitCode: code, stdoutLen: stdout.length, stderrLen: stderr.length }, toolLogLabel('runContainerCommand', 'succeeded'))
          resolve({
            success: true,
            exitCode: code,
            stdout,
            stderr,
          })
          return
        }

        logger.warn({ ...ctx, exitCode: code, signal, stdoutLen: stdout.length, stderrLen: stderr.length }, toolLogLabel('runContainerCommand', 'non-zero exit'))
        resolve({
          success: false,
          exitCode: code,
          stdout,
          stderr,
          error: `Command exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`,
        })
      })
    })
  },
})
