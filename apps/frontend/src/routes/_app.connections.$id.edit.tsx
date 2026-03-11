import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ConnectionForm } from '@/components/connections/connection-form'
import { connectionQueries } from '@/lib/queries/connections'
import { getConnectionMeta } from '@/lib/constants/connection-types'
import { connectionConfigFields } from '@/lib/schemas/connection'

export const Route = createFileRoute('/_app/connections/$id/edit')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(connectionQueries.detail(params.id)),
  pendingComponent: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
  component: EditConnectionPage,
})

function EditConnectionPage() {
  const { id } = Route.useParams()
  const { data: connection } = useSuspenseQuery(connectionQueries.detail(id))
  const meta = getConnectionMeta(connection.type)

  // Filter out masked password fields (value '••••••••') so they show as empty
  const passwordKeys = new Set(
    (connectionConfigFields[connection.type] ?? [])
      .filter(f => f.type === 'password')
      .map(f => f.key)
  )

  const parsedConfig: Record<string, string> = {}
  for (const [key, value] of Object.entries(connection.config)) {
    if (!passwordKeys.has(key)) {
      parsedConfig[key] = String(value)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/connections">
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
              <BreadcrumbPage>编辑连接</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2.5">
          <img src={meta.icon} alt={meta.label} className="size-5" />
        </div>
        <h1 className="text-2xl font-bold">编辑 {meta.label} 连接</h1>
      </div>

      <ConnectionForm
        mode="edit"
        type={connection.type}
        defaultValues={{
          id: connection.id,
          name: connection.name,
          config: parsedConfig,
        }}
      />
    </div>
  )
}
