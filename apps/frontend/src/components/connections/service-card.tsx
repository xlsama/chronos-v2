import { Link } from '@tanstack/react-router'
import type { Connection } from '@chronos/shared'
import { CheckCircle2, Circle, Loader2, Pencil, TestTube, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getConnectionMeta } from '@/lib/constants/connection-types'

const statusConfig = {
  connected: { label: '已连接', icon: CheckCircle2, className: 'text-green-500' },
  disconnected: { label: '未连接', icon: Circle, className: 'text-gray-400' },
  error: { label: '错误', icon: XCircle, className: 'text-red-500' },
}

interface ServiceCardProps {
  connection: Connection
  onTest: (id: string) => void
  isTesting?: boolean
}

export function ServiceCard({ connection, onTest, isTesting }: ServiceCardProps) {
  const meta = getConnectionMeta(connection.type)
  const status = statusConfig[connection.status]
  const TypeIcon = meta.icon
  const StatusIcon = status.icon

  return (
    <Card className="relative transition-shadow hover:shadow-md">
      <div className={cn('absolute right-3 top-3', status.className)} title={status.label}>
        <StatusIcon className="size-4" />
      </div>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn('rounded-lg bg-muted p-2.5', meta.color)}>
          <TypeIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="truncate font-medium">{connection.name}</span>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-xs">
              {meta.label}
            </Badge>
            {connection.mcpStatus === 'registering' && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                <Loader2 className="mr-1 size-3 animate-spin" />
                MCP 注册中
              </Badge>
            )}
            {connection.mcpStatus === 'registered' && (
              <Badge variant="outline" className="border-green-200 bg-green-50 text-xs text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                MCP 就绪
              </Badge>
            )}
            {connection.mcpStatus === 'error' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                    MCP 错误
                  </Badge>
                </TooltipTrigger>
                {connection.mcpError && (
                  <TooltipContent>
                    <p className="max-w-xs">{connection.mcpError}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onTest(connection.id)}
            disabled={isTesting}
          >
            {isTesting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <TestTube className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            asChild
          >
            <Link to="/connections/$id/edit" params={{ id: connection.id }}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
