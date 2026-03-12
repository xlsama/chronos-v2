import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Save, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ops/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { opsQueries, useDeleteDocument, useUpdateDocument } from "@/lib/queries/ops";

const RUNBOOK_PUBLICATION_STATUSES = ["draft", "published", "active", "archived"] as const;

export const Route = createFileRoute("/_app/runbooks/$id")({
  loader: ({ context, params }) => {
    void context.queryClient.ensureQueryData(opsQueries.projectList());
    void context.queryClient.ensureQueryData(opsQueries.document(params.id));
  },
  component: RunbookDetailPage,
});

function RunbookDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: projects } = useSuspenseQuery(opsQueries.projectList());
  const { data: runbook } = useSuspenseQuery(opsQueries.document(id));

  const [title, setTitle] = useState(runbook.title);
  const [content, setContent] = useState(runbook.content ?? "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const projectName = projects.find((project) => project.id === runbook.projectId)?.name ?? "项目";
  const documentTitle = title.trim() || "未命名 runbook";
  const publicationStatus = normalizePublicationStatus(runbook.publicationStatus);

  async function handleSave() {
    await updateDocument.mutateAsync({
      id,
      data: {
        title: documentTitle,
        description: runbook.description ?? undefined,
        tags: runbook.tags,
        content,
        publicationStatus,
      },
    });

    toast.success("runbook 已保存");
  }

  async function handleDelete() {
    await deleteDocument.mutateAsync(id);
    setDeleteDialogOpen(false);
    toast.success("runbook 已删除");
    navigate({ to: "/runbooks" });
  }

  return (
    <div className="min-h-full bg-background px-4 py-4 pb-8 md:px-8 md:py-6 md:pb-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className="flex flex-col gap-5"
      >
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/runbooks">Runbook</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{projectName}</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{documentTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="runbook 标题"
                className="h-auto border-0 bg-transparent px-0 text-3xl font-medium tracking-tight shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground lg:justify-end">
                <StatusBadge
                  value={publicationStatus}
                  label={getRunbookStatusLabel(publicationStatus)}
                />
                <Badge variant="outline" className="rounded-full bg-background/80 font-normal">
                  创建于 {dayjs(runbook.createdAt).format("YYYY-MM-DD HH:mm")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive hover:text-white"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleteDocument.isPending}
                >
                  <Trash2 data-icon="inline-start" className="size-4" />
                  删除
                </Button>
                <Button
                  onClick={() => void handleSave()}
                  disabled={updateDocument.isPending || documentTitle.length === 0}
                >
                  <Save data-icon="inline-start" className="size-4" />
                  保存
                </Button>
              </div>
            </div>
          </div>
        </section>

        <Card className="mb-4 overflow-hidden rounded-2xl shadow-sm md:mb-6">
          <CardContent className="p-0">
            <MarkdownEditor
              value={content}
              onChange={setContent}
              resetKey={id}
              minHeight={760}
              className="rounded-none border-0"
              placeholder="编写 runbook 的步骤、约束、回滚说明和验证命令。"
            />
          </CardContent>
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除 runbook？</AlertDialogTitle>
              <AlertDialogDescription>删除「{runbook.title}」后将无法恢复。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteDocument.isPending}>取消</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteDocument.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  void handleDelete();
                }}
              >
                {deleteDocument.isPending ? "删除中..." : "确认删除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </div>
  );
}

function normalizePublicationStatus(value: string) {
  return RUNBOOK_PUBLICATION_STATUSES.includes(
    value as (typeof RUNBOOK_PUBLICATION_STATUSES)[number],
  )
    ? (value as (typeof RUNBOOK_PUBLICATION_STATUSES)[number])
    : "draft";
}

function getRunbookStatusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
    active: "启用",
    archived: "已归档",
    pending: "待处理",
    processing: "处理中",
    ready: "就绪",
    indexed: "已索引",
    not_indexed: "未索引",
    error: "异常",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}
