import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_app/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <Button>hello</Button>
    </div>
  )
}
