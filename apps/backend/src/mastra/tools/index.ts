import { updateIncidentStatus } from './incident-tools'
import { searchRunbooks, getRunbook, createRunbook } from './runbook-tools'
import { searchSkills, getSkill } from './skill-tools'
import { listConnections } from './connection-tools'
import { getServiceNeighbors, getServiceMap } from './service-map-tools'

export const tools = {
  updateIncidentStatus,
  searchRunbooks,
  getRunbook,
  createRunbook,
  searchSkills,
  getSkill,
  listConnections,
  getServiceNeighbors,
  getServiceMap,
}
