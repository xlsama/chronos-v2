import * as k8s from '@kubernetes/client-node'
import { z } from 'zod'
import type { MCPFactory, MCPServer, MCPTool } from '../types'

export const kubernetesFactory: MCPFactory = async (connection) => {
  const { kubeconfig, context, namespace: defaultNamespace } = connection.config as {
    kubeconfig: string
    context?: string
    namespace?: string
  }

  const kc = new k8s.KubeConfig()
  kc.loadFromString(kubeconfig)

  if (context) {
    kc.setCurrentContext(context)
  }

  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)

  // Verify connectivity
  await coreApi.listNamespace({ limit: 1 })

  const defaultNs = defaultNamespace ?? 'default'

  const tools: Record<string, MCPTool> = {
    getPods: {
      description: 'List Kubernetes pods.',
      parameters: z.object({
        namespace: z.string().optional().describe(`Namespace (default: ${defaultNs})`),
        labelSelector: z.string().optional().describe('Label selector (e.g. app=nginx)'),
      }),
      execute: async ({ namespace, labelSelector }: { namespace?: string; labelSelector?: string }) => {
        const ns = namespace ?? defaultNs
        const result = await coreApi.listNamespacedPod({
          namespace: ns,
          ...(labelSelector && { labelSelector }),
        })
        return {
          pods: result.items.map((p) => ({
            name: p.metadata?.name,
            namespace: p.metadata?.namespace,
            status: p.status?.phase,
            ready: p.status?.containerStatuses?.every((c) => c.ready) ?? false,
            restarts: p.status?.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) ?? 0,
            node: p.spec?.nodeName,
            age: p.metadata?.creationTimestamp,
          })),
        }
      },
    },
    getPodLogs: {
      description: 'Get logs from a Kubernetes pod.',
      parameters: z.object({
        name: z.string().describe('Pod name'),
        namespace: z.string().optional().describe(`Namespace (default: ${defaultNs})`),
        container: z.string().optional().describe('Container name (for multi-container pods)'),
        tail: z.number().optional().default(100).describe('Number of lines from the end (default: 100)'),
      }),
      execute: async ({ name, namespace, container, tail }: { name: string; namespace?: string; container?: string; tail?: number }) => {
        const ns = namespace ?? defaultNs
        const result = await coreApi.readNamespacedPodLog({
          name,
          namespace: ns,
          ...(container && { container }),
          tailLines: tail ?? 100,
        })
        return { logs: result }
      },
    },
    describeResource: {
      description: 'Get detailed information about a Kubernetes resource (pod, deployment, service, node).',
      parameters: z.object({
        kind: z.enum(['pod', 'deployment', 'service', 'node', 'configmap', 'secret']).describe('Resource kind'),
        name: z.string().describe('Resource name'),
        namespace: z.string().optional().describe(`Namespace (default: ${defaultNs})`),
      }),
      execute: async ({ kind, name, namespace }: { kind: string; name: string; namespace?: string }) => {
        const ns = namespace ?? defaultNs
        switch (kind) {
          case 'pod':
            return await coreApi.readNamespacedPod({ name, namespace: ns })
          case 'deployment':
            return await appsApi.readNamespacedDeployment({ name, namespace: ns })
          case 'service':
            return await coreApi.readNamespacedService({ name, namespace: ns })
          case 'node':
            return await coreApi.readNode({ name })
          case 'configmap':
            return await coreApi.readNamespacedConfigMap({ name, namespace: ns })
          case 'secret': {
            const secret = await coreApi.readNamespacedSecret({ name, namespace: ns })
            // Mask secret data
            if (secret.data) {
              const masked: Record<string, string> = {}
              for (const key of Object.keys(secret.data)) {
                masked[key] = '••••••••'
              }
              secret.data = masked
            }
            return secret
          }
          default:
            return { error: `Unsupported resource kind: ${kind}` }
        }
      },
    },
    getEvents: {
      description: 'List Kubernetes events (warnings, errors, etc).',
      parameters: z.object({
        namespace: z.string().optional().describe(`Namespace (default: ${defaultNs})`),
      }),
      execute: async ({ namespace }: { namespace?: string }) => {
        const ns = namespace ?? defaultNs
        const result = await coreApi.listNamespacedEvent({ namespace: ns })
        return {
          events: result.items
            .sort((a, b) => {
              const ta = a.lastTimestamp?.getTime() ?? 0
              const tb = b.lastTimestamp?.getTime() ?? 0
              return tb - ta
            })
            .slice(0, 50)
            .map((e) => ({
              type: e.type,
              reason: e.reason,
              message: e.message,
              object: `${e.involvedObject?.kind}/${e.involvedObject?.name}`,
              count: e.count,
              lastSeen: e.lastTimestamp,
            })),
        }
      },
    },
    execInPod: {
      description: 'Execute a command inside a Kubernetes pod.',
      parameters: z.object({
        name: z.string().describe('Pod name'),
        namespace: z.string().optional().describe(`Namespace (default: ${defaultNs})`),
        container: z.string().optional().describe('Container name (for multi-container pods)'),
        command: z.string().describe('Command to execute (e.g. "ls -la /app")'),
      }),
      execute: async ({ name, namespace, container, command }: { name: string; namespace?: string; container?: string; command: string }) => {
        const ns = namespace ?? defaultNs
        const exec = new k8s.Exec(kc)
        const cmdParts = ['sh', '-c', command]

        return new Promise<unknown>((resolve) => {
          let stdout = ''
          let stderr = ''

          exec.exec(
            ns,
            name,
            container ?? '',
            cmdParts,
            {
              write: (data: string) => { stdout += data },
            } as any,
            {
              write: (data: string) => { stderr += data },
            } as any,
            null,
            false,
            (status) => {
              resolve({ stdout, stderr, status: status?.status ?? 'Unknown' })
            },
          ).catch((err) => {
            resolve({ error: err.message })
          })
        })
      },
    },
  }

  const server: MCPServer = {
    connectionId: connection.id,
    connectionName: connection.name,
    connectionType: 'kubernetes',
    tools,
    dispose: async () => {
      // KubeConfig client has no persistent connections to close
    },
  }

  return server
}
