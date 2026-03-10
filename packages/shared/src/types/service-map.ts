export interface ServiceMapNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface ServiceMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface ServiceMapGraph {
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
}

export interface ServiceMap {
  id: string;
  name: string;
  description: string | null;
  graph: ServiceMapGraph;
  createdAt: string;
  updatedAt: string;
}
