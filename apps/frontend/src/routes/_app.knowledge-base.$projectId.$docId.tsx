import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/knowledge-base/$projectId/$docId')({
  beforeLoad: () => {
    throw redirect({ to: '/knowledge-base' })
  },
})
