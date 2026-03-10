import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { snapdom } from '@zumer/snapdom'
import { Camera } from 'lucide-react'
import { useRef } from 'react'

export function ServiceMap() {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleDownload = async () => {
    if (!containerRef.current) return
    await snapdom.download(containerRef.current, { type: 'png', scale: 2 })
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100vh-12rem)] w-full rounded-lg border"
    >
      <ReactFlow fitView>
        <Background />
        <Controls>
          <button
            className="react-flow__controls-button"
            onClick={handleDownload}
            title="导出为 PNG 图片"
          >
            <Camera className="!max-h-3.5 !max-w-3.5 !fill-none" />
          </button>
        </Controls>
      </ReactFlow>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p className="text-muted-foreground text-sm">Service Map 开发中</p>
      </div>
    </div>
  )
}
