import { useState } from 'react'
import { Search } from 'lucide-react'
import type { Connection } from '@chronos/shared'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ServiceCard } from './service-card'
import { useDeleteConnection, useTestConnection } from '@/lib/queries/connections'

interface ServiceGridProps {
  connections: Connection[]
  search?: string
}

export function ServiceGrid({ connections, search }: ServiceGridProps) {
  const testMutation = useTestConnection()
  const deleteMutation = useDeleteConnection()
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null)

  if (connections.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia>
            <Search className="size-8" />
          </EmptyMedia>
          <EmptyTitle>暂无连接</EmptyTitle>
          <EmptyDescription>
            {search ? '没有匹配的服务' : '点击"添加服务"开始配置'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {connections.map((connection) => (
          <ServiceCard
            key={connection.id}
            connection={connection}
            onTest={(id) =>
              testMutation.mutate(id, {
                onSuccess: (data) => {
                  if (data.success) {
                    toast.success(`${connection.name} 连接测试成功`)
                  } else {
                    toast.error(`${connection.name} 连接测试失败`, { description: data.message })
                  }
                },
                onError: (err) => {
                  toast.error(`${connection.name} 连接测试失败`, { description: err.message })
                },
              })
            }
            isTesting={testMutation.isPending && testMutation.variables === connection.id}
            onDelete={() => setDeleteTarget(connection)}
            isDeleting={deleteMutation.isPending && deleteMutation.variables === connection.id}
          />
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除连接</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除连接 <span className="font-medium text-foreground">{deleteTarget?.name}</span> 吗？删除后将同时注销 MCP 注册，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return
                deleteMutation.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success(`${deleteTarget.name} 已删除`)
                    setDeleteTarget(null)
                  },
                  onError: (err) => {
                    toast.error(`删除 ${deleteTarget.name} 失败`, { description: err.message })
                  },
                })
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
