import net from 'node:net'
import http from 'node:http'
import postgres from 'postgres'
import Redis from 'ioredis'
import { ofetch } from 'ofetch'

const DEFAULT_TIMEOUT = 5000

type ConnectionType =
  | 'mysql' | 'postgresql' | 'redis' | 'mongodb' | 'clickhouse'
  | 'elasticsearch' | 'kafka' | 'rabbitmq' | 'kubernetes' | 'docker'
  | 'argocd' | 'grafana' | 'prometheus' | 'sentry' | 'jenkins'
  | 'datadog' | 'pagerduty' | 'opsgenie' | 'apisix' | 'kong'
  | 'airflow' | 'loki' | 'ssh'

interface TestResult {
  success: boolean
  message?: string
}

function testTcpConnection(host: string, port: number, timeout = DEFAULT_TIMEOUT): Promise<TestResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ success: false, message: `TCP connection to ${host}:${port} timed out` })
    }, timeout)

    socket.connect(port, host, () => {
      clearTimeout(timer)
      socket.destroy()
      resolve({ success: true })
    })

    socket.on('error', (err) => {
      clearTimeout(timer)
      socket.destroy()
      resolve({ success: false, message: `TCP connection failed: ${err.message}` })
    })
  })
}

async function testHttpEndpoint(
  url: string,
  options?: { headers?: Record<string, string>; timeout?: number },
): Promise<TestResult> {
  try {
    await ofetch(url, {
      timeout: options?.timeout ?? DEFAULT_TIMEOUT,
      headers: options?.headers,
    })
    return { success: true }
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  }
}

async function testPostgresql(config: Record<string, unknown>): Promise<TestResult> {
  const sql = postgres({
    host: config.host as string,
    port: Number(config.port ?? 5432),
    database: config.database as string,
    username: config.username as string,
    password: config.password as string,
    connect_timeout: 5,
    max: 1,
  })
  try {
    await sql`SELECT 1`
    return { success: true }
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  } finally {
    await sql.end().catch(() => {})
  }
}

async function testRedis(config: Record<string, unknown>): Promise<TestResult> {
  const client = new Redis({
    host: config.host as string,
    port: Number(config.port ?? 6379),
    password: config.password as string | undefined,
    db: Number(config.db ?? 0),
    connectTimeout: DEFAULT_TIMEOUT,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  })
  try {
    await client.connect()
    await client.ping()
    return { success: true }
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  } finally {
    await client.quit().catch(() => {})
  }
}

async function testMysql(config: Record<string, unknown>): Promise<TestResult> {
  try {
    const mysql = await import('mysql2/promise')
    const conn = await mysql.createConnection({
      host: config.host as string,
      port: Number(config.port ?? 3306),
      user: config.user as string,
      password: config.password as string,
      database: config.database as string | undefined,
      connectTimeout: DEFAULT_TIMEOUT,
    })
    try {
      await conn.query('SELECT 1')
      return { success: true }
    } finally {
      await conn.end().catch(() => {})
    }
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  }
}

async function testElasticsearch(config: Record<string, unknown>): Promise<TestResult> {
  const url = config.url as string
  const headers: Record<string, string> = {}
  if (config.apiKey) headers['Authorization'] = `ApiKey ${config.apiKey}`
  return testHttpEndpoint(`${url.replace(/\/$/, '')}/_cluster/health`, { headers })
}

async function testGrafana(config: Record<string, unknown>): Promise<TestResult> {
  const url = config.url as string
  const headers: Record<string, string> = {}
  if (config.token) headers['Authorization'] = `Bearer ${config.token}`
  return testHttpEndpoint(`${url.replace(/\/$/, '')}/api/health`, { headers })
}

async function testPrometheus(config: Record<string, unknown>): Promise<TestResult> {
  const url = config.url as string
  return testHttpEndpoint(`${url.replace(/\/$/, '')}/-/healthy`)
}

async function testJenkins(config: Record<string, unknown>): Promise<TestResult> {
  const url = config.url as string
  const headers: Record<string, string> = {}
  if (config.user && config.token) {
    headers['Authorization'] = `Basic ${Buffer.from(`${config.user}:${config.token}`).toString('base64')}`
  }
  return testHttpEndpoint(`${url.replace(/\/$/, '')}/api/json`, { headers })
}

async function testArgocd(config: Record<string, unknown>): Promise<TestResult> {
  const url = config.url as string
  const headers: Record<string, string> = {}
  if (config.token) headers['Authorization'] = `Bearer ${config.token}`
  return testHttpEndpoint(`${url.replace(/\/$/, '')}/api/v1/session/userinfo`, { headers })
}

async function testSentry(config: Record<string, unknown>): Promise<TestResult> {
  const baseUrl = (config.url as string | undefined) ?? 'https://sentry.io'
  const headers: Record<string, string> = {}
  if (config.token) headers['Authorization'] = `Bearer ${config.token}`
  return testHttpEndpoint(`${baseUrl.replace(/\/$/, '')}/api/0/`, { headers })
}

async function testClickhouse(config: Record<string, unknown>): Promise<TestResult> {
  const host = config.host as string
  const port = Number(config.port ?? 8123)
  return testHttpEndpoint(`http://${host}:${port}/ping`)
}

async function testMongodb(config: Record<string, unknown>): Promise<TestResult> {
  const host = config.host as string
  const port = Number(config.port ?? 27017)
  return testTcpConnection(host, port)
}

async function testKafka(config: Record<string, unknown>): Promise<TestResult> {
  const brokers = config.brokers as string
  if (!brokers) return { success: false, message: 'No brokers configured' }
  const firstBroker = brokers.split(',')[0].trim()
  const [host, portStr] = firstBroker.split(':')
  return testTcpConnection(host, Number(portStr ?? 9092))
}

async function testRabbitmq(config: Record<string, unknown>): Promise<TestResult> {
  const host = config.host as string
  const port = Number(config.port ?? 5672)
  return testTcpConnection(host, port)
}

async function testKubernetes(config: Record<string, unknown>): Promise<TestResult> {
  const kubeconfig = config.kubeconfig as string
  if (!kubeconfig) return { success: false, message: 'No kubeconfig provided' }
  const serverMatch = kubeconfig.match(/server:\s*(https?:\/\/[^\s]+)/)
  if (!serverMatch) return { success: false, message: 'Cannot extract server URL from kubeconfig' }
  return testHttpEndpoint(`${serverMatch[1]}/version`)
}

async function testDocker(config: Record<string, unknown>): Promise<TestResult> {
  const socketPath = config.socketPath as string | undefined
  const url = config.url as string | undefined

  if (socketPath) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, message: 'Docker socket connection timed out' })
      }, DEFAULT_TIMEOUT)

      const req = http.request(
        { socketPath, path: '/version', method: 'GET' },
        (res) => {
          clearTimeout(timer)
          res.resume()
          resolve({ success: res.statusCode === 200 })
        },
      )
      req.on('error', (err) => {
        clearTimeout(timer)
        resolve({ success: false, message: `Docker socket error: ${err.message}` })
      })
      req.end()
    })
  }

  if (url) {
    return testHttpEndpoint(`${url.replace(/\/$/, '')}/version`)
  }

  return { success: false, message: 'No socketPath or url configured' }
}

async function testDatadog(config: Record<string, unknown>): Promise<TestResult> {
  const site = config.site as string || 'datadoghq.com'
  return testHttpEndpoint(`https://api.${site}/api/v1/validate`, {
    headers: { 'DD-API-KEY': String(config.apiKey || '') },
  })
}

async function testPagerduty(config: Record<string, unknown>): Promise<TestResult> {
  return testHttpEndpoint('https://api.pagerduty.com/abilities', {
    headers: { Authorization: `Token token=${config.apiKey}` },
  })
}

async function testOpsgenie(config: Record<string, unknown>): Promise<TestResult> {
  const apiUrl = (config.apiUrl as string) || 'https://api.opsgenie.com'
  return testHttpEndpoint(`${apiUrl.replace(/\/$/, '')}/v2/heartbeats`, {
    headers: { Authorization: `GenieKey ${config.apiKey}` },
  })
}

async function testApisix(config: Record<string, unknown>): Promise<TestResult> {
  const host = config.host as string || 'localhost'
  const adminApiPort = Number(config.adminApiPort ?? 9180)
  return testHttpEndpoint(`http://${host}:${adminApiPort}/apisix/admin/routes`, {
    headers: { 'X-API-KEY': String(config.adminKey || '') },
  })
}

async function testKong(config: Record<string, unknown>): Promise<TestResult> {
  const region = config.region as string || 'us'
  return testHttpEndpoint(`https://${region}.api.konghq.com/v2/users/me`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  })
}

async function testAirflow(config: Record<string, unknown>): Promise<TestResult> {
  const url = config.url as string
  const headers: Record<string, string> = {}
  if (config.username) {
    headers['Authorization'] = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`
  }
  return testHttpEndpoint(`${url.replace(/\/$/, '')}/api/v1/health`, { headers })
}

async function testLoki(config: Record<string, unknown>): Promise<TestResult> {
  const url = config.url as string
  const headers: Record<string, string> = {}
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`
  return testHttpEndpoint(`${url.replace(/\/$/, '')}/api/health`, { headers })
}

async function testSsh(config: Record<string, unknown>): Promise<TestResult> {
  const host = config.host as string
  const port = Number(config.port ?? 22)
  return testTcpConnection(host, port)
}

const testers: Record<ConnectionType, (config: Record<string, unknown>) => Promise<TestResult>> = {
  postgresql: testPostgresql,
  redis: testRedis,
  mysql: testMysql,
  elasticsearch: testElasticsearch,
  grafana: testGrafana,
  prometheus: testPrometheus,
  jenkins: testJenkins,
  argocd: testArgocd,
  sentry: testSentry,
  clickhouse: testClickhouse,
  mongodb: testMongodb,
  kafka: testKafka,
  rabbitmq: testRabbitmq,
  kubernetes: testKubernetes,
  docker: testDocker,
  datadog: testDatadog,
  pagerduty: testPagerduty,
  opsgenie: testOpsgenie,
  apisix: testApisix,
  kong: testKong,
  airflow: testAirflow,
  loki: testLoki,
  ssh: testSsh,
}

export async function testConnection(
  type: string,
  config: Record<string, unknown>,
): Promise<TestResult> {
  const tester = testers[type as ConnectionType]
  if (!tester) return { success: false, message: `Unsupported connection type: ${type}` }

  try {
    return await tester(config)
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  }
}
