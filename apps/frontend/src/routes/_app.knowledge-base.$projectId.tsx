import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/knowledge-base/$projectId')({
  component: () => <Outlet />,
})
