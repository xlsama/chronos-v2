import { useMemo } from "react";
import type { Runbook } from "@chronos/shared";
import { useNavigate } from "@tanstack/react-router";

import { DataTable } from "@/components/inbox/data-table";
import { getRunbookColumns } from "./runbook-columns";
import { useDeleteRunbook } from "@/lib/queries/runbooks";

interface RunbookListProps {
  runbooks: Runbook[];
}

export function RunbookList({ runbooks }: RunbookListProps) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteRunbook();

  const columns = useMemo(
    () =>
      getRunbookColumns({
        onEdit: (runbook) => navigate({ to: "/runbooks/$id", params: { id: runbook.id } }),
        onDelete: (id) => deleteMutation.mutate(id),
      }),
    [navigate, deleteMutation],
  );

  return <DataTable columns={columns} data={runbooks} emptyDescription="没有创建任何 Runbook" />;
}
