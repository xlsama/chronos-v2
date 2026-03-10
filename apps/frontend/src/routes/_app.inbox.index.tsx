import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { columns } from "@/components/inbox/columns";
import { DataTable } from "@/components/inbox/data-table";
import { Button } from "@/components/ui/button";
import { CreateIncidentDialog } from "@/components/inbox/create-incident-dialog";
import { incidentQueries } from "@/lib/queries/incidents";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_app/inbox/")({
  component: InboxPage,
});

function InboxPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);

  const { data } = useQuery(
    incidentQueries.list({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })
  );

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">收件箱</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          创建事件
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={items}
        pageCount={pageCount}
        page={page}
        onPageChange={setPage}
      />
      <CreateIncidentDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
