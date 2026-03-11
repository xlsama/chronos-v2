import { useCallback, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useDebounceFn } from "ahooks";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { RunbookEditor } from "@/components/runbooks/runbook-editor";
import { runbookQueries, useUpdateRunbook, useDeleteRunbook } from "@/lib/queries/runbooks";

export const Route = createFileRoute("/_app/runbooks/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(runbookQueries.detail(params.id)),
  pendingComponent: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
  component: RunbookEditPage,
});

function RunbookEditPage() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const { data: runbook } = useSuspenseQuery(runbookQueries.detail(id));

  const [title, setTitle] = useState(runbook.title);
  const [tagsInput, setTagsInput] = useState(runbook.tags.join(", "));
  const contentRef = useRef(runbook.content);

  const updateMutation = useUpdateRunbook();
  const deleteMutation = useDeleteRunbook();

  const handleContentChange = useCallback((markdown: string) => {
    contentRef.current = markdown;
  }, []);

  const { run: handleSave } = useDebounceFn(
    () => {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      updateMutation.mutate(
        { id, data: { title, content: contentRef.current, tags } },
        { onSuccess: () => navigate({ to: "/runbooks" }) },
      );
    },
    { wait: 300 },
  );

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => navigate({ to: "/runbooks" }),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/runbooks">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-sm border-none text-lg font-semibold shadow-none focus-visible:ring-0"
          placeholder="Runbook 标题"
        />
        <div className="flex items-center gap-1">
          {runbook.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <Input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="标签 (逗号分隔)"
          className="ml-auto max-w-48 text-sm"
        />
        <Button onClick={handleSave} disabled={updateMutation.isPending} size="sm">
          <Save className="mr-2 size-4" />
          {updateMutation.isPending ? "保存中..." : "保存"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="mr-2 size-4" />
          删除
        </Button>
      </div>
      <div className="flex-1 p-6">
        <RunbookEditor initialContent={runbook.content} onChange={handleContentChange} />
      </div>
    </div>
  );
}
