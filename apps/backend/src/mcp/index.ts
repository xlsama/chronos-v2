import { mcpRegistry } from './registry'
import { mysqlFactory } from './providers/mysql'
import { postgresqlFactory } from './providers/postgresql'
import { redisFactory } from './providers/redis'
import { elasticsearchFactory } from './providers/elasticsearch'
import { kubernetesFactory } from './providers/kubernetes'
import { grafanaFactory } from './providers/grafana'
import { prometheusFactory } from './providers/prometheus'

export function registerAllFactories() {
  mcpRegistry.registerFactory('mysql', mysqlFactory)
  mcpRegistry.registerFactory('postgresql', postgresqlFactory)
  mcpRegistry.registerFactory('redis', redisFactory)
  mcpRegistry.registerFactory('elasticsearch', elasticsearchFactory)
  mcpRegistry.registerFactory('kubernetes', kubernetesFactory)
  mcpRegistry.registerFactory('grafana', grafanaFactory)
  mcpRegistry.registerFactory('prometheus', prometheusFactory)
}
