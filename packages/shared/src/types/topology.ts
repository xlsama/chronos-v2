export interface TopologyNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface Topology {
  id: string;
  name: string;
  description: string | null;
  graph: TopologyGraph;
  createdAt: string;
  updatedAt: string;
}
