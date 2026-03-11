import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ProjectList } from "@/components/knowledge-base/project-list";
import { ProjectFormDialog } from "@/components/knowledge-base/project-form-dialog";
import { kbQueries } from "@/lib/queries/knowledge-base";

export const Route = createFileRoute("/_app/knowledge-base/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(kbQueries.projectList()),
  pendingComponent: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
  component: KnowledgeBasePage,
});

function KnowledgeBasePage() {
  const { data: projects } = useSuspenseQuery(kbQueries.projectList());
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-6 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium">知识库</h1>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            新建项目
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 pb-6">
        <ProjectList projects={projects} />
      </div>
      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
