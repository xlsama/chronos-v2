import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/connections/$id/edit')({
  beforeLoad: () => {
    throw redirect({ to: '/services' })
  },
})
