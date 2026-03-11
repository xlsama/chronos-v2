import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Box,
  Database,
  Zap,
  ArrowLeftRight,
  Search,
  Globe,
  Activity,
  GitBranch,
  Container,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ServiceNodeData, ServiceNodeType } from '@chronos/shared'

export const nodeTypeMeta: Record<ServiceNodeType, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  service:    { icon: Box,            color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200'   },
  database:   { icon: Database,       color: 'text-green-600',   bg: 'bg-green-50',   border: 'border-green-200'  },
  cache:      { icon: Zap,            color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  queue:      { icon: ArrowLeftRight, color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  search:     { icon: Search,         color: 'text-yellow-600',  bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  gateway:    { icon: Globe,          color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-200'   },
  monitoring: { icon: Activity,       color: 'text-pink-600',    bg: 'bg-pink-50',    border: 'border-pink-200'   },
  cicd:       { icon: GitBranch,      color: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200'   },
  container:  { icon: Container,      color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  external:   { icon: ExternalLink,   color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200'  },
}

type ServiceNodeProps = NodeProps & { data: ServiceNodeData; selected?: boolean }

function ServiceNodeComponent({ data, selected }: ServiceNodeProps) {
  const meta = nodeTypeMeta[data.serviceType] ?? nodeTypeMeta.service

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground/50 !h-2 !w-2" />
      <div
        className={cn(
          'flex min-w-[140px] items-center gap-2.5 rounded-lg border-2 px-3 py-2 shadow-sm transition-colors',
          meta.bg,
          meta.border,
          selected && 'ring-primary/50 ring-2',
        )}
      >
        <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', meta.bg)}>
          <meta.icon className={cn('size-4', meta.color)} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{data.label}</div>
          <div className="text-muted-foreground truncate text-xs">{data.serviceType}</div>
        </div>
        {data.connectionId && (
          <div className="absolute -right-1 -top-1 size-2.5 rounded-full bg-green-500 ring-2 ring-white" />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground/50 !h-2 !w-2" />
    </>
  )
}

export const ServiceNode = memo(ServiceNodeComponent)

export const nodeTypes = {
  serviceNode: ServiceNode,
}
