import { updateIncidentStatus } from './incident-tools'
import { searchRunbooks, getRunbook, createRunbook } from './runbook-tools'
import { searchSkills, getSkill } from './skill-tools'
import { listConnections } from './connection-tools'
import { getServiceNeighbors, getTopologyGraph } from './topology-tools'

export const tools = {
  updateIncidentStatus,
  searchRunbooks,
  getRunbook,
  createRunbook,
  searchSkills,
  getSkill,
  listConnections,
  getServiceNeighbors,
  getTopologyGraph,
}
