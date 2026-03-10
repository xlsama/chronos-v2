import { createFileRoute } from "@tanstack/react-router";

import { columns } from "@/components/inbox/columns";
import { DataTable } from "@/components/inbox/data-table";
import { mockIncidents } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/inbox/")({
  component: InboxPage,
});

function InboxPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">收件箱</h1>
      </div>
      <DataTable columns={columns} data={mockIncidents} />
    </div>
  );
}
