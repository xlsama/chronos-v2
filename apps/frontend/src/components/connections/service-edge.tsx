import { memo } from 'react'
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import type { ServiceEdgeData, EdgeRelationType } from '@chronos/shared'

// ── Style config ──────────────────────────────────────────

export const RELATION_TYPE_LABELS: Record<EdgeRelationType, string> = {
  'calls': '调用',
  'depends-on': '依赖',
  'reads-from': '读取',
  'writes-to': '写入',
  'publishes': '发布',
  'subscribes': '消费',
}

interface RelationStyle {
  color: string
  dasharray: string
  duration: number // animation duration in seconds
}

export const RELATION_STYLES: Record<EdgeRelationType, RelationStyle> = {
  'calls':      { color: '#2563eb', dasharray: '10,10', duration: 0.8 },
  'depends-on': { color: '#6b7280', dasharray: '6,6,2,6', duration: 2 },
  'reads-from': { color: '#16a34a', dasharray: '8,4,4,4', duration: 1.2 },
  'writes-to':  { color: '#ea580c', dasharray: '10,10', duration: 0.8 },
  'publishes':  { color: '#9333ea', dasharray: '6,3,2,3,2,3', duration: 1.5 },
  'subscribes': { color: '#9333ea', dasharray: '4,4,4,4,4', duration: 1.5 },
}

const CRITICAL_COLOR = '#ef4444'

// ── Helpers ───────────────────────────────────────────────

function getEdgeLabel(data?: ServiceEdgeData): string {
  if (!data) return ''
  const typeLabel = RELATION_TYPE_LABELS[data.relationType] ?? ''
  if (data.description) return data.description
  return typeLabel
}

export function inferRelationType(label?: string): EdgeRelationType {
  if (!label) return 'depends-on'
  const l = label.toLowerCase()
  if (l.includes('call') || l.includes('调用')) return 'calls'
  if (l.includes('read') || l.includes('读')) return 'reads-from'
  if (l.includes('write') || l.includes('写')) return 'writes-to'
  if (l.includes('publish') || l.includes('发布')) return 'publishes'
  if (l.includes('subscrib') || l.includes('消费') || l.includes('订阅')) return 'subscribes'
  return 'depends-on'
}

// ── Component ─────────────────────────────────────────────

type ServiceEdgeProps = EdgeProps<Edge<ServiceEdgeData>>

function ServiceEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: ServiceEdgeProps) {
  const relationType = data?.relationType ?? 'depends-on'
  const isCritical = data?.critical === true
  const style = RELATION_STYLES[relationType] ?? RELATION_STYLES['depends-on']

  const strokeColor = isCritical ? CRITICAL_COLOR : style.color
  const strokeWidth = isCritical ? 3 : 1.5
  const duration = isCritical ? style.duration * 0.5 : style.duration

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const label = getEdgeLabel(data)
  const markerId = `marker-${id}`

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 2 2 L 10 6 L 2 10"
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.5"
          />
        </marker>
      </defs>

      {/* Main edge path with dash flow animation */}
      <path
        className="react-flow__edge-path"
        d={edgePath}
        stroke={strokeColor}
        strokeWidth={selected ? strokeWidth + 1 : strokeWidth}
        strokeDasharray={style.dasharray}
        fill="none"
        markerEnd={`url(#${markerId})`}
        style={{
          animation: `dashdraw ${duration}s linear infinite`,
          filter: isCritical ? `drop-shadow(0 0 3px ${strokeColor})` : undefined,
        }}
      />

      {/* Invisible wider path for easier click targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded bg-white/90 px-1.5 py-0.5 text-xs leading-tight shadow-sm dark:bg-zinc-900/90"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              color: strokeColor,
              fontWeight: isCritical ? 600 : 400,
              borderColor: strokeColor,
              border: `1px solid ${strokeColor}20`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const ServiceEdge = memo(ServiceEdgeComponent)

export const edgeTypes = {
  serviceEdge: ServiceEdge,
}
