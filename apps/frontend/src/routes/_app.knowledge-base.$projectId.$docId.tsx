import { useCallback, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Save, Trash2, RefreshCw } from "lucide-react";
import { useDebounceFn } from "ahooks";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DocumentStatusBadge } from "@/components/knowledge-base/document-status-badge";
import { RunbookEditor } from "@/components/runbooks/runbook-editor";
import { DocumentViewer } from "@/components/knowledge-base/document-viewer";
import {
  kbQueries,
  useUpdateDocument,
  useDeleteDocument,
  useReprocessDocument,
} from "@/lib/queries/knowledge-base";

export const Route = createFileRoute(
  "/_app/knowledge-base/$projectId/$docId",
)({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(kbQueries.documentDetail(params.docId)),
  pendingComponent: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  ),
  component: DocumentEditPage,
});

function DocumentEditPage() {
  const { projectId, docId } = Route.useParams();
  const navigate = Route.useNavigate();
  const { data: doc } = useSuspenseQuery(kbQueries.documentDetail(docId));

  const [title, setTitle] = useState(doc.title);
  const contentRef = useRef(doc.content ?? "");

  const updateMutation = useUpdateDocument();
  const deleteMutation = useDeleteDocument();
  const reprocessMutation = useReprocessDocument();

  const handleContentChange = useCallback((markdown: string) => {
    contentRef.current = markdown;
  }, []);

  const { run: handleSave } = useDebounceFn(
    () => {
      updateMutation.mutate(
        {
          id: docId,
          data: { title, content: contentRef.current },
        },
        {
          onSuccess: () => {
            if (doc.type === "markdown") {
              reprocessMutation.mutate(docId);
            }
            navigate({ to: "/knowledge-base/$projectId", params: { projectId } });
          },
        },
      );
    },
    { wait: 300 },
  );

  const handleDelete = () => {
    if (!confirm("确定删除该文档？")) return;
    deleteMutation.mutate(docId, {
      onSuccess: () =>
        navigate({ to: "/knowledge-base/$projectId", params: { projectId } }),
    });
  };

  const isMarkdown = doc.type === "markdown";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Button variant="ghost" size="icon" asChild>
          <Link
            to="/knowledge-base/$projectId"
            params={{ projectId }}
          >
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        {isMarkdown ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="max-w-sm border-none text-lg font-semibold shadow-none focus-visible:ring-0"
            placeholder="文档标题"
          />
        ) : (
          <h2 className="text-lg font-semibold">{doc.title}</h2>
        )}
        <DocumentStatusBadge status={doc.status} />
        <div className="ml-auto flex items-center gap-2">
          {!isMarkdown && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => reprocessMutation.mutate(docId)}
              disabled={reprocessMutation.isPending}
            >
              <RefreshCw className="mr-2 size-4" />
              重新处理
            </Button>
          )}
          {isMarkdown && (
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              size="sm"
            >
              <Save className="mr-2 size-4" />
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          )}
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
      </div>
      <div className="flex-1 p-6">
        {isMarkdown ? (
          <RunbookEditor
            initialContent={doc.content ?? ""}
            onChange={handleContentChange}
          />
        ) : (
          <DocumentViewer document={doc} />
        )}
      </div>
    </div>
  );
}
