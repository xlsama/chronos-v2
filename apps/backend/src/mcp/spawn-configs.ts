import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { SpawnConfigBuilder } from './types'

export const spawnConfigBuilders: Record<string, SpawnConfigBuilder> = {
  mysql: (config) => ({
    command: 'npx',
    args: ['-y', '@benborla29/mcp-server-mysql'],
    env: {
      MYSQL_HOST: String(config.host || 'localhost'),
      MYSQL_PORT: String(config.port || 3306),
      MYSQL_USER: String(config.username || 'root'),
      MYSQL_PASS: String(config.password || ''),
      MYSQL_DB: String(config.database || ''),
      ALLOW_INSERT_OPERATION: 'true',
      ALLOW_UPDATE_OPERATION: 'true',
      ALLOW_DELETE_OPERATION: 'true',
    },
  }),

  postgresql: (config) => ({
    command: 'npx',
    args: ['-y', '@henkey/postgres-mcp-server'],
    env: {
      POSTGRES_CONNECTION_STRING: `postgresql://${config.username}:${config.password}@${config.host}:${config.port || 5432}/${config.database}`,
    },
  }),

  redis: (config) => {
    const password = config.password ? `:${config.password}@` : ''
    const db = config.db ? `/${config.db}` : ''
    return {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-redis', `redis://${password}${config.host || 'localhost'}:${config.port || 6379}${db}`],
      env: {},
    }
  },

  mongodb: (config) => {
    const auth = config.username ? `${config.username}:${config.password}@` : ''
    return {
      command: 'npx',
      args: ['-y', 'mongodb-mcp-server'],
      env: {
        MDB_MCP_CONNECTION_STRING: `mongodb://${auth}${config.host || 'localhost'}:${config.port || 27017}/${config.database || ''}`,
      },
    }
  },

  clickhouse: (config) => ({
    command: 'npx',
    args: ['-y', '@clickhouse/mcp-server'],
    env: {
      CLICKHOUSE_HOST: String(config.host || 'localhost'),
      CLICKHOUSE_PORT: String(config.port || 8123),
      CLICKHOUSE_USER: String(config.username || 'default'),
      CLICKHOUSE_PASSWORD: String(config.password || ''),
    },
  }),

  elasticsearch: (config) => {
    const env: Record<string, string> = {
      ES_URL: String(config.url || 'http://localhost:9200'),
    }
    if (config.apiKey) {
      env.ES_API_KEY = String(config.apiKey)
    } else if (config.username) {
      env.ES_USERNAME = String(config.username)
      env.ES_PASSWORD = String(config.password || '')
    }
    return {
      command: 'npx',
      args: ['-y', '@elastic/mcp-server-elasticsearch'],
      env,
    }
  },

  kafka: (config) => ({
    command: 'kafka-mcp-server',
    args: [],
    env: {
      KAFKA_BROKERS: String(config.brokers || 'localhost:9092'),
      ...(config.username ? {
        KAFKA_SASL_USERNAME: String(config.username),
        KAFKA_SASL_PASSWORD: String(config.password || ''),
        KAFKA_SASL_MECHANISM: String(config.mechanism || 'PLAIN'),
      } : {}),
    },
  }),

  rabbitmq: (config) => ({
    command: 'uvx',
    args: [
      'mcp-server-rabbitmq',
      '--host', String(config.host || 'localhost'),
      '--port', String(config.port || 5672),
      '--username', String(config.username || 'guest'),
      '--password', String(config.password || 'guest'),
      ...(config.vhost ? ['--virtual-host', String(config.vhost)] : []),
    ],
    env: {},
  }),

  kubernetes: (config) => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'chronos-k8s-'))
    const kubeconfigPath = join(tmpDir, 'kubeconfig')
    writeFileSync(kubeconfigPath, String(config.kubeconfig || ''))
    return {
      command: 'npx',
      args: ['-y', 'kubernetes-mcp-server'],
      env: {
        KUBECONFIG: kubeconfigPath,
      },
    }
  },

  docker: (config) => ({
    command: 'uvx',
    args: ['docker-mcp'],
    env: {
      ...(config.socketPath ? { DOCKER_HOST: `unix://${config.socketPath}` } : {}),
    },
  }),

  argocd: (config) => ({
    command: 'argocd-mcp-server',
    args: [],
    env: {
      ARGOCD_BASE_URL: String(config.url || ''),
      ARGOCD_AUTH_TOKEN: String(config.authToken || ''),
    },
  }),

  grafana: (config) => ({
    command: 'uvx',
    args: ['mcp-grafana'],
    env: {
      GRAFANA_URL: String(config.url || ''),
      GRAFANA_SERVICE_ACCOUNT_TOKEN: String(config.apiKey || ''),
    },
  }),

  prometheus: (config) => ({
    command: 'npx',
    args: ['-y', 'prometheus-mcp'],
    env: {
      PROMETHEUS_URL: String(config.url || ''),
    },
  }),

  sentry: (config) => ({
    command: 'npx',
    args: ['-y', '@sentry/mcp-server'],
    env: {
      SENTRY_ACCESS_TOKEN: String(config.authToken || ''),
    },
  }),

  jenkins: (config) => ({
    command: 'npx',
    args: ['-y', '@kud/mcp-jenkins'],
    env: {
      JENKINS_URL: String(config.url || ''),
      JENKINS_USERNAME: String(config.username || ''),
      JENKINS_API_TOKEN: String(config.apiToken || ''),
    },
  }),

  datadog: (config) => ({
    command: 'npx',
    args: ['-y', '@winor30/mcp-server-datadog'],
    env: {
      DATADOG_API_KEY: String(config.apiKey || ''),
      DATADOG_APP_KEY: String(config.appKey || ''),
      DATADOG_SITE: String(config.site || 'datadoghq.com'),
    },
  }),

  pagerduty: (config) => ({
    command: 'uvx',
    args: ['pagerduty-mcp', '--enable-write-tools'],
    env: {
      PAGERDUTY_API_KEY: String(config.apiKey || ''),
    },
  }),

  opsgenie: (config) => ({
    command: 'npx',
    args: ['-y', 'mcp-opsgenie'],
    env: {
      OPSGENIE_API_KEY: String(config.apiKey || ''),
      ...(config.apiUrl ? { OPSGENIE_API_URL: String(config.apiUrl) } : {}),
    },
  }),

  apisix: (config) => ({
    command: 'npx',
    args: ['-y', 'apisix-mcp'],
    env: {
      APISIX_SERVER_HOST: String(config.host || 'localhost'),
      APISIX_SERVER_PORT: String(config.port || 9080),
      APISIX_ADMIN_API_PORT: String(config.adminApiPort || 9180),
      APISIX_ADMIN_API_PREFIX: String(config.adminApiPrefix || '/apisix/admin'),
      APISIX_ADMIN_KEY: String(config.adminKey || ''),
    },
  }),

  kong: (config) => ({
    command: String(config.binaryPath || 'mcp-konnect'),
    args: [],
    env: {
      KONNECT_ACCESS_TOKEN: String(config.accessToken || ''),
      KONNECT_REGION: String(config.region || 'us'),
    },
  }),

  airflow: (config) => ({
    command: 'uvx',
    args: ['--python', '3.12', 'mcp-airflow-api'],
    env: {
      AIRFLOW_BASE_URL: String(config.url || ''),
      AIRFLOW_USERNAME: String(config.username || ''),
      AIRFLOW_PASSWORD: String(config.password || ''),
    },
  }),

  loki: (config) => ({
    command: 'uvx',
    args: ['grafana-loki-mcp'],
    env: {
      GRAFANA_URL: String(config.url || ''),
      GRAFANA_API_KEY: String(config.apiKey || ''),
    },
  }),

  ssh: (config) => {
    const env: Record<string, string> = {
      SSH_HOST: String(config.host || ''),
      SSH_PORT: String(config.port || 22),
      SSH_USERNAME: String(config.username || ''),
    }
    if (config.password) env.SSH_PASSWORD = String(config.password)
    if (config.privateKey) env.SSH_PRIVATE_KEY = String(config.privateKey)
    return { command: 'uvx', args: ['ssh-mcp-server'], env }
  },
}
