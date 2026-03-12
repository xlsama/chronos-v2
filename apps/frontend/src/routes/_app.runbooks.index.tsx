import { useEffect, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ArrowRight, Clock3, Plus, ScrollText, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { ProjectDocument } from "@chronos/shared";
import { ProjectPicker } from "@/components/ops/project-picker";
import { StatusBadge } from "@/components/ops/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  async function handleDeleteRunbook(runbook: ProjectDocument) {
    if (!window.confirm(`删除「${runbook.title}」？此操作无法撤销。`)) return;

    await deleteDocument.mutateAsync(runbook.id);
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
          <div>
            <h1 className="text-xl font-medium tracking-tight">Runbook</h1>
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
            <div className="flex items-center gap-1 rounded-lg border p-1">
              <Button
                variant={publicationFilter === "draft" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setPublicationFilter("draft");
                  setCurrentPage(1);
                }}
              >
                草稿
              </Button>
              <Button
                variant={publicationFilter === "published" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setPublicationFilter("published");
                  setCurrentPage(1);
                }}
              >
                已发布
              </Button>
            </div>
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
            <div className="grid gap-3">
              {runbooks.map((runbook) => {
                const excerpt = buildRunbookExcerpt(runbook);

                return (
                  <Card
                    key={runbook.id}
                    className="overflow-hidden border-border/70 bg-card/90 shadow-sm transition-colors hover:border-foreground/15"
                  >
                    <CardContent className="flex flex-col gap-5 p-5">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            value={runbook.publicationStatus}
                            label={getRunbookStatusLabel(runbook.publicationStatus)}
                          />
                          <StatusBadge
                            value={runbook.status}
                            label={getRunbookStatusLabel(runbook.status)}
                          />
                        </div>

                        <Link
                          to="/runbooks/$id"
                          params={{ id: runbook.id }}
                          className="mt-4 block text-xl font-semibold tracking-tight transition-colors hover:text-foreground/80"
                        >
                          {runbook.title}
                        </Link>

                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {runbook.description ||
                            "用于重复性故障处理和运维检查的 Markdown 操作指南。"}
                        </p>

                        {excerpt ? (
                          <p className="mt-3 line-clamp-3 max-w-4xl whitespace-pre-line text-sm leading-6 text-foreground/80">
                            {excerpt}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {runbook.tags.length > 0 ? (
                            runbook.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="rounded-full bg-background/80"
                              >
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-full bg-background/80 text-muted-foreground"
                            >
                              无标签
                            </Badge>
                          )}
                        </div>

                        <div className="mt-auto flex flex-wrap items-center gap-4 pt-5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="size-3.5" />
                            更新于 {dayjs(runbook.updatedAt).format("YYYY-MM-DD HH:mm")}
                          </span>
                          <span>{runbook.source}</span>
                          <span>{runbook.fileName}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to="/runbooks/$id" params={{ id: runbook.id }}>
                            打开
                            <ArrowRight data-icon="inline-end" className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleteDocument.isPending}
                          onClick={() => void handleDeleteRunbook(runbook)}
                        >
                          <Trash2 data-icon="inline-start" className="size-4" />
                          删除
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
        </section>
      </motion.div>
    </div>
  );
}

function buildRunbookExcerpt(runbook: ProjectDocument) {
  const content = (runbook.content ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[>*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!content) return "";
  return truncateText(content, 100);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
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
