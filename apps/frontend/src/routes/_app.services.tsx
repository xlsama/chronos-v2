import { useState } from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { ProjectPicker } from '@/components/ops/project-picker'
import { ServicesLayoutProvider } from '@/contexts/services-layout-context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JsonBlock } from '@/components/ops/json-block'
import { opsQueries } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/services')({
  loader: ({ context }) => context.queryClient.ensureQueryData(opsQueries.projectList()),
  component: ServicesLayout,
})

function ServicesLayout() {
  const { data: projects } = useSuspenseQuery(opsQueries.projectList())
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projects[0]?.id)
  const activeProjectId = selectedProjectId ?? projects[0]?.id
  const [tab, setTab] = useState<string>('services')

  return (
    <div className="min-h-full bg-background px-4 py-4 md:px-8 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-medium tracking-tight">服务</h1>
          <ProjectPicker
            projects={projects}
            value={activeProjectId}
            onValueChange={setSelectedProjectId}
            placeholder="选择项目"
          />
        </div>

        <ServicesLayoutProvider value={{ activeProjectId, projects }}>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="services">服务列表</TabsTrigger>
              <TabsTrigger value="service-map">服务拓扑</TabsTrigger>
            </TabsList>
            <TabsContent value="services" className="mt-4">
              <Outlet />
            </TabsContent>
            <TabsContent value="service-map" className="mt-4">
              <ServiceMapTab projectId={activeProjectId} />
            </TabsContent>
          </Tabs>
        </ServicesLayoutProvider>
      </motion.div>
      <div className="h-8 shrink-0" />
    </div>
  )
}

function ServiceMapTab(props: { projectId?: string }) {
  const { data: serviceMapContext } = useQuery({
    ...opsQueries.serviceMapContext(props.projectId ?? ''),
    enabled: Boolean(props.projectId),
  })

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">当前项目的服务拓扑和依赖关系</p>
      <JsonBlock value={serviceMapContext ?? { graph: { nodes: [], edges: [] } }} />
    </div>
  )
}
