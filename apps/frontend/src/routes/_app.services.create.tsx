import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/services/create')({
  component: () => <Outlet />,
})
