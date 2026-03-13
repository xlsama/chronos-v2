import { useEffect, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Plus, ScrollText, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { ProjectDocument } from "@chronos/shared";
import { ProjectPicker } from "@/components/ops/project-picker";
import { StatusBadge } from "@/components/ops/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { opsQueries, useCreateMarkdownDocument, useDeleteDocument } from "@/lib/queries/ops";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/_app/runbooks/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opsQueries.projectList()),
  component: RunbooksPage,
});

function RunbooksPage() {
  const navigate = useNavigate();
  const { data: projects } = useSuspenseQuery(opsQueries.projectList());
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projects[0]?.id);
  const [publicationFilter, setPublicationFilter] = useState<"draft" | "published">("draft");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDocument | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(undefined);
      return;
    }

    const projectStillExists = selectedProjectId
      ? projects.some((project) => project.id === selectedProjectId)
      : false;

    if (!projectStillExists) {
      setSelectedProjectId(projects[0]?.id);
    }
  }, [projects, selectedProjectId]);

  const activeProjectId = selectedProjectId ?? projects[0]?.id;
  const runbooksQuery = useQuery({
    ...opsQueries.projectRunbooks(activeProjectId ?? "", {
      publicationStatus: publicationFilter,
      page: currentPage,
      pageSize: PAGE_SIZE,
    }),
    enabled: Boolean(activeProjectId),
  });

  const createRunbook = useCreateMarkdownDocument("runbook");
  const deleteDocument = useDeleteDocument();

  const runbooks = runbooksQuery.data?.data ?? [];
  const total = runbooksQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = getPaginationItems(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  async function handleCreateRunbook() {
    if (!activeProjectId) return;

    const runbook = await createRunbook.mutateAsync({
      projectId: activeProjectId,
      title: "未命名 runbook",
      content: "",
      publicationStatus: publicationFilter,
    });

    toast.success("runbook 已创建");
    navigate({ to: "/runbooks/$id", params: { id: runbook.id } });
  }

  async function handleDeleteRunbook() {
    if (!deleteTarget) return;

    await deleteDocument.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    toast.success("runbook 已删除");
  }

  return (
    <div className="min-h-full bg-background px-4 py-4 md:px-8 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-medium tracking-tight">Runbook</h1>
            <Tabs
              value={publicationFilter}
              onValueChange={(value) => {
                setPublicationFilter(value as "draft" | "published");
                setCurrentPage(1);
              }}
              className="data-[orientation=horizontal]:flex-row gap-0"
            >
              <TabsList>
                <TabsTrigger value="draft">草稿</TabsTrigger>
                <TabsTrigger value="published">已发布</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <ProjectPicker
              projects={projects}
              value={activeProjectId}
              onValueChange={(value) => {
                setSelectedProjectId(value);
                setCurrentPage(1);
              }}
              placeholder="选择项目"
            />
            <Button
              onClick={() => void handleCreateRunbook()}
              disabled={!activeProjectId || createRunbook.isPending}
            >
              <Plus data-icon="inline-start" className="size-4" />
              新建 runbook
            </Button>
          </div>
        </div>

        <section className="space-y-5">
          {!activeProjectId ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScrollText className="size-5" />
                </EmptyMedia>
                <EmptyTitle>未选择项目</EmptyTitle>
                <EmptyDescription>请先创建或选择项目，再添加 runbook。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : runbooks.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ScrollText className="size-5" />
                </EmptyMedia>
                <EmptyTitle>当前状态下暂无 runbook</EmptyTitle>
                <EmptyDescription>
                  你可以手动创建 runbook，或等待每日摘要任务把新的经验沉淀到这里。
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  onClick={() => void handleCreateRunbook()}
                  disabled={createRunbook.isPending}
                >
                  创建 runbook
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="divide-y rounded-lg border">
              {runbooks.map((runbook) => (
                <div key={runbook.id} className="flex items-center gap-3 px-4 py-3">
                  <StatusBadge
                    value={runbook.publicationStatus}
                    label={getRunbookStatusLabel(runbook.publicationStatus)}
                  />
                  <Link
                    to="/runbooks/$id"
                    params={{ id: runbook.id }}
                    className="min-w-0 flex-1 truncate font-medium transition-colors hover:text-foreground/80"
                  >
                    {runbook.title}
                  </Link>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {dayjs(runbook.updatedAt).format("MM-DD HH:mm")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={deleteDocument.isPending}
                    onClick={() => setDeleteTarget(runbook)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <Pagination className="pt-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (currentPage > 1) setCurrentPage((page) => page - 1);
                    }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>

                {pageItems.map((item, index) => (
                  <PaginationItem key={`${item}-${index}`}>
                    {item === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href="#"
                        isActive={item === currentPage}
                        onClick={(event) => {
                          event.preventDefault();
                          setCurrentPage(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (currentPage < totalPages) setCurrentPage((page) => page + 1);
                    }}
                    className={
                      currentPage === totalPages ? "pointer-events-none opacity-50" : undefined
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}

          <AlertDialog
            open={Boolean(deleteTarget)}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除 runbook？</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteTarget
                    ? `删除「${deleteTarget.title}」后将无法恢复。`
                    : "删除后将无法恢复。"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteDocument.isPending}>取消</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleteDocument.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleDeleteRunbook();
                  }}
                >
                  {deleteDocument.isPending ? "删除中..." : "确认删除"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </motion.div>
    </div>
  );
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

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages] as const;
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ] as const;
}
