import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

export function ServiceMap() {
  return (
    <div className="relative h-[calc(100vh-12rem)] w-full rounded-lg border">
      <ReactFlow fitView>
        <Background />
        <Controls />
      </ReactFlow>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p className="text-muted-foreground text-sm">Service Map 开发中</p>
      </div>
    </div>
  )
}
