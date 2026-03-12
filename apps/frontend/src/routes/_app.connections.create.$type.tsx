import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/connections/create/$type')({
  beforeLoad: () => {
    throw redirect({ to: '/services' })
  },
})
