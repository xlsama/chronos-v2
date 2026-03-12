import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/runbooks/$id')({
  beforeLoad: () => {
    throw redirect({ to: '/runbooks' })
  },
})
