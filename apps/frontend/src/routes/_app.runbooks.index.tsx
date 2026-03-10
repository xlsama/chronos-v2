import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { RunbookList } from '@/components/runbooks/runbook-list'
import { RunbookFormDialog } from '@/components/runbooks/runbook-form-dialog'
import { runbookQueries } from '@/lib/queries/runbooks'

export const Route = createFileRoute('/_app/runbooks/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(runbookQueries.list()),
  pendingComponent: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
  component: RunbooksPage,
})

function RunbooksPage() {
  const { data: runbooks } = useSuspenseQuery(runbookQueries.list())
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">运行手册</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          新建
        </Button>
      </div>
      <RunbookList runbooks={runbooks} />
      <RunbookFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
