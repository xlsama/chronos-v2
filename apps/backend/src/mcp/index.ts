import { mcpRegistry } from './registry'
import { spawnConfigBuilders } from './spawn-configs'

export function registerAllBuilders() {
  for (const [type, builder] of Object.entries(spawnConfigBuilders)) {
    mcpRegistry.registerBuilder(type, builder)
  }
}
