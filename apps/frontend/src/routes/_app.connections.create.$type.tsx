import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ConnectionType } from '@chronos/shared'

import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ConnectionForm } from '@/components/connections/connection-form'
import { getConnectionMeta } from '@/lib/constants/connection-types'

export const Route = createFileRoute('/_app/connections/create/$type')({
  component: CreateConnectionFormPage,
})

function CreateConnectionFormPage() {
  const { type } = Route.useParams()
  const meta = getConnectionMeta(type as ConnectionType)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/connections/create">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/connections">连接管理</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/connections/create">添加服务</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{meta.label}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-muted p-2.5 ${meta.color}`}>
          <meta.icon className="size-5" />
        </div>
        <h1 className="text-2xl font-bold">新建 {meta.label} 连接</h1>
      </div>

      <ConnectionForm mode="create" type={type as ConnectionType} />
    </div>
  )
}
