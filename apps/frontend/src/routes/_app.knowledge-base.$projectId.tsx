import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Spinner } from "@/components/ui/spinner";
import { kbQueries } from "@/lib/queries/knowledge-base";

export const Route = createFileRoute("/_app/knowledge-base/$projectId")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(kbQueries.projectDetail(params.projectId)),
      context.queryClient.ensureQueryData(kbQueries.documentList(params.projectId)),
    ]),
  pendingComponent: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
  component: ProjectLayout,
});

function ProjectLayout() {
  return <Outlet />;
}
