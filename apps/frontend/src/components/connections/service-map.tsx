import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { snapdom } from '@zumer/snapdom'
import { useQuery } from '@tanstack/react-query'
import {
  Camera,
  Plus,
  Save,
  Trash2,
  ChevronDown,
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
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { connectionQueries } from '@/lib/queries/connections'
import { kbQueries } from '@/lib/queries/knowledge-base'
import { nodeTypes, nodeTypeMeta } from './service-node'
import { edgeTypes, inferRelationType, RELATION_STYLES, RELATION_TYPE_LABELS } from './service-edge'
import type {
  ServiceNodeData,
  ServiceNodeType,
  ServiceEdgeData,
  EdgeRelationType,
  EdgeProtocol,
  ServiceMap as ServiceMapType,
  ServiceMapGraph,
} from '@chronos/shared'

// ── Stable defaults ────────────────────────────────────────
const EMPTY_CONNECTIONS: never[] = []
const EMPTY_KB_PROJECTS: never[] = []

// ── Constants ──────────────────────────────────────────────

const SERVICE_NODE_TYPES: { type: ServiceNodeType; label: string }[] = [
  { type: 'service',    label: '微服务' },
  { type: 'database',   label: '数据库' },
  { type: 'cache',      label: '缓存' },
  { type: 'queue',      label: '消息队列' },
  { type: 'search',     label: '搜索引擎' },
  { type: 'gateway',    label: '网关' },
  { type: 'monitoring', label: '监控' },
  { type: 'cicd',       label: 'CI/CD' },
  { type: 'container',  label: '容器' },
  { type: 'external',   label: '外部服务' },
]

const RELATION_TYPES: { value: EdgeRelationType; label: string }[] = [
  { value: 'calls',       label: '调用 (HTTP/gRPC)' },
  { value: 'depends-on',  label: '依赖' },
  { value: 'reads-from',  label: '读取' },
  { value: 'writes-to',   label: '写入' },
  { value: 'publishes',   label: '发布消息' },
  { value: 'subscribes',  label: '消费消息' },
]

const PROTOCOLS: { value: EdgeProtocol; label: string }[] = [
  { value: 'http',   label: 'HTTP' },
  { value: 'grpc',   label: 'gRPC' },
  { value: 'tcp',    label: 'TCP' },
  { value: 'amqp',   label: 'AMQP' },
  { value: 'kafka',  label: 'Kafka' },
  { value: 'redis',  label: 'Redis' },
  { value: 'sql',    label: 'SQL' },
  { value: 'custom', label: '自定义' },
]

const nodeTypeIcons: Record<ServiceNodeType, typeof Box> = {
  service: Box,
  database: Database,
  cache: Zap,
  queue: ArrowLeftRight,
  search: Search,
  gateway: Globe,
  monitoring: Activity,
  cicd: GitBranch,
  container: Container,
  external: ExternalLink,
}

// ── Helpers ────────────────────────────────────────────────

function inferServiceType(label: string): ServiceNodeType {
  const l = label.toLowerCase()
  if (/redis|缓存|cache|memcache/.test(l)) return 'cache'
  if (/mysql|postgres|mongodb|clickhouse|数据库|database|mariadb|sqlite/.test(l)) return 'database'
  if (/kafka|rabbitmq|消息|mq|queue|pulsar|nats/.test(l)) return 'queue'
  if (/elasticsearch|搜索|search|opensearch|solr/.test(l)) return 'search'
  if (/gateway|网关|nginx|kong|apisix|负载|lb/.test(l)) return 'gateway'
  if (/grafana|prometheus|sentry|监控|monitor|alert/.test(l)) return 'monitoring'
  if (/jenkins|argocd|cicd|ci\/cd|github.action|gitlab.ci/.test(l)) return 'cicd'
  if (/kubernetes|docker|k8s|容器|container|pod/.test(l)) return 'container'
  if (/external|第三方|third.party/.test(l)) return 'external'
  return 'service'
}

function slugifyNodeId(label: string, existingIds: Set<string>): string {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'node'
  let id = base
  let suffix = 2
  while (existingIds.has(id)) {
    id = `${base}-${suffix++}`
  }
  return id
}

// ── Component ──────────────────────────────────────────────

interface ServiceMapEditorProps {
  serviceMap: ServiceMapType
  onSave: (graph: ServiceMapGraph) => void
  saving?: boolean
}

export function ServiceMapEditor({ serviceMap, onSave, saving }: ServiceMapEditorProps) {
  const containerRefValue = useRef<HTMLDivElement | null>(null)
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    containerRefValue.current = el
  }, [])

  const initialNodes = useMemo(
    () => serviceMap.graph.nodes.map((n) => ({
      ...n,
      type: 'serviceNode',
      data: {
        ...n.data,
        serviceType: n.data.serviceType || inferServiceType(String(n.data.label ?? '')),
        label: n.data.label || n.id,
      },
    })),
    [serviceMap.id],
  )
  const initialEdges = useMemo(
    () => serviceMap.graph.edges.map((e) => ({
      ...e,
      type: 'serviceEdge',
      data: {
        ...((e.data ?? {}) as ServiceEdgeData),
        relationType: (e.data as ServiceEdgeData)?.relationType || inferRelationType(e.label as string | undefined),
        description: (e.data as ServiceEdgeData)?.description || (typeof e.label === 'string' && e.label !== (e.data as ServiceEdgeData)?.relationType ? e.label : undefined),
      } as ServiceEdgeData,
    })),
    [serviceMap.id],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const { data: connectionsData } = useQuery({ ...connectionQueries.list(), staleTime: 5 * 60 * 1000 })
  const { data: kbProjectsData } = useQuery({ ...kbQueries.projectList(), staleTime: 5 * 60 * 1000 })
  const connectionsList = connectionsData ?? EMPTY_CONNECTIONS
  const kbProjectsList = kbProjectsData?.data ?? EMPTY_KB_PROJECTS

  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null),
    [nodes, selectedNodeId],
  )
  const selectedEdge = useMemo(
    () => (selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : null),
    [edges, selectedEdgeId],
  )

  const panelOpen = selectedNode != null || selectedEdge != null

  // ── Handlers ────────────────────────────────────────────

  const markDirty = useCallback(() => setDirty(true), [])

  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      if (changes.some((c) => c.type === 'position' || c.type === 'remove')) markDirty()
    },
    [onNodesChange, markDirty],
  )

  const handleEdgesChange: typeof onEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes)
      if (changes.some((c) => c.type === 'remove')) markDirty()
    },
    [onEdgesChange, markDirty],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: `edge-${connection.source}-${connection.target}`,
        type: 'serviceEdge',
        data: { relationType: 'calls' as EdgeRelationType } as ServiceEdgeData,
      }
      setEdges((eds) => addEdge(newEdge, eds))
      markDirty()
    },
    [setEdges, markDirty],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      setSelectedEdgeId(null)
    },
    [],
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id)
      setSelectedNodeId(null)
    },
    [],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [])

  const handleAddNode = useCallback(
    (serviceType: ServiceNodeType) => {
      const label = SERVICE_NODE_TYPES.find((t) => t.type === serviceType)?.label ?? serviceType
      setNodes((nds) => {
        const existingIds = new Set(nds.map((n) => n.id))
        const id = slugifyNodeId(label, existingIds)
        const newNode: Node = {
          id,
          type: 'serviceNode',
          position: { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 },
          data: { label, serviceType } satisfies ServiceNodeData,
        }
        setSelectedNodeId(id)
        setSelectedEdgeId(null)
        return [...nds, newNode]
      })
      markDirty()
    },
    [setNodes, markDirty],
  )

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
      setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId))
      setSelectedNodeId(null)
      markDirty()
    } else if (selectedEdgeId) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId))
      setSelectedEdgeId(null)
      markDirty()
    }
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges, markDirty])

  const handleSave = useCallback(() => {
    const graph: ServiceMapGraph = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: 'serviceNode',
        position: n.position,
        data: n.data as ServiceNodeData,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data as ServiceEdgeData | undefined,
      })),
    }
    onSave(graph)
    setDirty(false)
  }, [nodes, edges, onSave])

  const handleDownload = async () => {
    const el = containerRefValue.current
    if (!el) return
    await snapdom.download(el, { type: 'png', scale: 2 })
  }

  const updateNodeData = useCallback(
    (field: keyof ServiceNodeData, value: unknown) => {
      if (!selectedNodeId) return
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId ? { ...n, data: { ...n.data, [field]: value } } : n,
        ),
      )
      markDirty()
    },
    [selectedNodeId, setNodes, markDirty],
  )

  const updateNodeId = useCallback(
    (oldId: string, newId: string) => {
      setNodes((nds) => nds.map((n) => (n.id === oldId ? { ...n, id: newId } : n)))
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          id: e.source === oldId || e.target === oldId
            ? `edge-${e.source === oldId ? newId : e.source}-${e.target === oldId ? newId : e.target}`
            : e.id,
          source: e.source === oldId ? newId : e.source,
          target: e.target === oldId ? newId : e.target,
        })),
      )
      setSelectedNodeId(newId)
      markDirty()
    },
    [setNodes, setEdges, markDirty],
  )

  const updateEdgeData = useCallback(
    (field: keyof ServiceEdgeData, value: unknown) => {
      if (!selectedEdgeId) return
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== selectedEdgeId) return e
          return { ...e, data: { ...((e.data as ServiceEdgeData) ?? { relationType: 'calls' }), [field]: value } }
        }),
      )
      markDirty()
    },
    [selectedEdgeId, setEdges, markDirty],
  )

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 size-3.5" />
              添加节点
              <ChevronDown className="ml-1 size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SERVICE_NODE_TYPES.map(({ type, label }) => {
              const Icon = nodeTypeIcons[type]
              return (
                <DropdownMenuItem key={type} onClick={() => handleAddNode(type)}>
                  <Icon className="mr-2 size-4" />
                  {label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {(selectedNodeId || selectedEdgeId) && (
          <Button variant="outline" size="sm" onClick={handleDeleteSelected}>
            <Trash2 className="mr-1 size-3.5" />
            删除
          </Button>
        )}

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Camera className="mr-1 size-3.5" />
          导出
        </Button>

        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          <Save className="mr-1 size-3.5" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>

      {/* Canvas + panel */}
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            deleteKeyCode="Delete"
          >
            <Background />
            <Controls />
            <MapLegend nodes={nodes} edges={edges} />
          </ReactFlow>
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">
              点击"添加节点"开始构建服务拓扑
            </p>
          </div>
        )}

        {/* Properties panel */}
        <Sheet open={panelOpen} onOpenChange={(open) => { if (!open) { setSelectedNodeId(null); setSelectedEdgeId(null) } }} modal={false}>
          <SheetContent side="right" className="w-80 overflow-y-auto p-4 sm:w-80" onInteractOutside={(e) => e.preventDefault()}>
            {selectedNode && (
              <NodePropertiesPanel
                node={selectedNode}
                connections={connectionsList}
                kbProjects={kbProjectsList}
                allNodeIds={nodes.map((n) => n.id)}
                onUpdate={updateNodeData}
                onUpdateId={updateNodeId}
              />
            )}
            {selectedEdge && !selectedNode && (
              <EdgePropertiesPanel
                edge={selectedEdge}
                onUpdate={updateEdgeData}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}

// ── Hooks ─────────────────────────────────────────────────

function usePrevNodeId(nodeId: string) {
  const ref = useRef(nodeId)
  const prev = ref.current
  ref.current = nodeId
  return prev
}

// ── Node Properties Panel ──────────────────────────────────

interface NodePropertiesPanelProps {
  node: Node
  connections: Array<{ id: string; name: string; type: string; status: string }>
  kbProjects: Array<{ id: string; name: string; description?: string | null }>
  allNodeIds: string[]
  onUpdate: (field: keyof ServiceNodeData, value: unknown) => void
  onUpdateId: (oldId: string, newId: string) => void
}

function NodePropertiesPanel({ node, connections, kbProjects, allNodeIds, onUpdate, onUpdateId }: NodePropertiesPanelProps) {
  const data = node.data as ServiceNodeData
  const [editingId, setEditingId] = useState(node.id)
  const [idError, setIdError] = useState<string | null>(null)

  // Sync editingId when selected node changes
  const prevNodeId = usePrevNodeId(node.id)
  if (prevNodeId !== node.id) {
    setEditingId(node.id)
    setIdError(null)
  }

  const handleIdChange = (value: string) => {
    setEditingId(value)
    if (!value.trim()) {
      setIdError('ID 不能为空')
    } else if (!/^[a-z0-9-]+$/.test(value)) {
      setIdError('仅允许小写字母、数字和连字符')
    } else if (value !== node.id && allNodeIds.includes(value)) {
      setIdError('ID 已存在')
    } else {
      setIdError(null)
    }
  }

  const handleIdConfirm = () => {
    if (!idError && editingId !== node.id && editingId.trim()) {
      onUpdateId(node.id, editingId)
    }
  }

  return (
    <>
      <SheetHeader className="mb-4">
        <SheetTitle className="text-base">节点属性</SheetTitle>
      </SheetHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Node ID</Label>
          <Input
            value={editingId}
            onChange={(e) => handleIdChange(e.target.value)}
            onBlur={handleIdConfirm}
            onKeyDown={(e) => { if (e.key === 'Enter') handleIdConfirm() }}
            className={idError ? 'border-red-500' : ''}
          />
          {idError && <p className="text-xs text-red-500">{idError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>名称</Label>
          <Input
            value={data.label ?? ''}
            onChange={(e) => onUpdate('label', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>类型</Label>
          <Select
            value={data.serviceType}
            onValueChange={(v) => onUpdate('serviceType', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_NODE_TYPES.map(({ type, label }) => (
                <SelectItem key={type} value={type}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>描述</Label>
          <Input
            value={data.description ?? ''}
            onChange={(e) => onUpdate('description', e.target.value || undefined)}
            placeholder="可选描述..."
          />
        </div>

        <div className="space-y-1.5">
          <Label>标签</Label>
          <Input
            value={(data.tags ?? []).join(', ')}
            onChange={(e) => {
              const tags = e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
              onUpdate('tags', tags.length > 0 ? tags : undefined)
            }}
            placeholder="逗号分隔..."
          />
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label>关联 Connection</Label>
          <Select
            value={data.connectionId ?? '__none__'}
            onValueChange={(v) => onUpdate('connectionId', v === '__none__' ? undefined : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="无" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">无</SelectItem>
              {connections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>关联知识库项目</Label>
          <Select
            value={data.kbProjectId ?? '__none__'}
            onValueChange={(v) => onUpdate('kbProjectId', v === '__none__' ? undefined : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="无" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">无</SelectItem>
              {kbProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  )
}

// ── Edge Properties Panel ──────────────────────────────────

interface EdgePropertiesPanelProps {
  edge: Edge
  onUpdate: (field: keyof ServiceEdgeData, value: unknown) => void
}

function EdgePropertiesPanel({ edge, onUpdate }: EdgePropertiesPanelProps) {
  const data = (edge.data as ServiceEdgeData) ?? { relationType: 'calls' }

  return (
    <>
      <SheetHeader className="mb-4">
        <SheetTitle className="text-base">连线属性</SheetTitle>
      </SheetHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>关系类型</Label>
          <Select
            value={data.relationType}
            onValueChange={(v) => onUpdate('relationType', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATION_TYPES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>协议</Label>
          <Select
            value={data.protocol ?? '__none__'}
            onValueChange={(v) => onUpdate('protocol', v === '__none__' ? undefined : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="无" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">无</SelectItem>
              {PROTOCOLS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>描述</Label>
          <Input
            value={data.description ?? ''}
            onChange={(e) => onUpdate('description', e.target.value || undefined)}
            placeholder="可选描述..."
          />
        </div>

        <div className="flex items-center justify-between">
          <Label>关键路径</Label>
          <Switch
            checked={data.critical ?? false}
            onCheckedChange={(v) => onUpdate('critical', v)}
          />
        </div>
      </div>
    </>
  )
}

// ── Map Legend ─────────────────────────────────────────────

const NODE_TYPE_LABELS: Record<ServiceNodeType, string> = {
  service: '微服务', database: '数据库', cache: '缓存', queue: '消息队列',
  search: '搜索引擎', gateway: '网关', monitoring: '监控', cicd: 'CI/CD',
  container: '容器', external: '外部服务',
}

function MapLegend({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const usedNodeTypes = useMemo(() => {
    const types = new Set<ServiceNodeType>()
    for (const n of nodes) {
      const st = (n.data as ServiceNodeData)?.serviceType
      if (st) types.add(st)
    }
    return Array.from(types)
  }, [nodes])

  const usedEdgeTypes = useMemo(() => {
    const types = new Set<EdgeRelationType>()
    let hasCritical = false
    for (const e of edges) {
      const d = e.data as ServiceEdgeData | undefined
      if (d?.relationType) types.add(d.relationType)
      if (d?.critical) hasCritical = true
    }
    return { types: Array.from(types), hasCritical }
  }, [edges])

  if (usedNodeTypes.length === 0 && usedEdgeTypes.types.length === 0) return null

  return (
    <Panel position="bottom-right" className="!m-2 min-w-[120px] rounded-lg border bg-white/95 p-3 shadow-sm backdrop-blur dark:bg-zinc-900/95">
      <div className="text-xs font-semibold mb-2">图例</div>

      {usedNodeTypes.length > 0 && (
        <div className="space-y-1 mb-2">
          {usedNodeTypes.map((type) => {
            const meta = nodeTypeMeta[type]
            if (!meta) return null
            return (
              <div key={type} className="flex items-center gap-2">
                <div className={`size-3 rounded border-2 ${meta.border} ${meta.bg}`} />
                <span className="text-[11px] text-muted-foreground">{NODE_TYPE_LABELS[type] ?? type}</span>
              </div>
            )
          })}
        </div>
      )}

      {usedEdgeTypes.types.length > 0 && (
        <>
          {usedNodeTypes.length > 0 && <Separator className="my-2" />}
          <div className="space-y-1">
            {usedEdgeTypes.types.map((type) => {
              const s = RELATION_STYLES[type]
              if (!s) return null
              return (
                <div key={type} className="flex items-center gap-2">
                  <svg width="24" height="8" className="shrink-0">
                    <line x1="0" y1="4" x2="24" y2="4" stroke={s.color} strokeDasharray={s.dasharray} strokeWidth="2" />
                  </svg>
                  <span className="text-[11px] text-muted-foreground">{RELATION_TYPE_LABELS[type]}</span>
                </div>
              )
            })}
            {usedEdgeTypes.hasCritical && (
              <div className="flex items-center gap-2">
                <svg width="24" height="8" className="shrink-0">
                  <line x1="0" y1="4" x2="24" y2="4" stroke="#ef4444" strokeWidth="3" />
                </svg>
                <span className="text-[11px] text-muted-foreground">关键路径</span>
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  )
}

// ── Empty state wrapper ────────────────────────────────────

export function ServiceMapEmpty({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState('')

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <Globe className="text-muted-foreground size-6" />
        </div>
        <div>
          <h3 className="font-medium">创建 Service Map</h3>
          <p className="text-muted-foreground text-sm mt-1">
            构建服务拓扑图，定义服务间的依赖关系，关联 Connection 和知识库。
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Service Map 名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) onCreate(name.trim())
            }}
          />
          <Button onClick={() => name.trim() && onCreate(name.trim())} disabled={!name.trim()}>
            创建
          </Button>
        </div>
      </div>
    </div>
  )
}
