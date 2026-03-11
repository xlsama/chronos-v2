import { useState } from "react";
import type { Runbook } from "@chronos/shared";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MoreHorizontal, Pencil, ScrollText, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDeleteRunbook } from "@/lib/queries/runbooks";

const PAGE_SIZE = 10;

function extractExcerpt(markdown: string, maxLength = 120): string {
  const text = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (currentPage > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

interface RunbookListProps {
  runbooks: Runbook[];
}

export function RunbookList({ runbooks }: RunbookListProps) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteRunbook();
  const totalPages = Math.max(1, Math.ceil(runbooks.length / PAGE_SIZE));
  const [rawPage, setCurrentPage] = useState(1);
  const currentPage = Math.min(rawPage, totalPages);

  if (runbooks.length === 0) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ScrollText />
          </EmptyMedia>
          <EmptyTitle>没有创建任何 Runbook</EmptyTitle>
          <EmptyDescription>
            创建 Runbook 来记录运维操作流程
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRunbooks = runbooks.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="flex min-h-0 flex-1 flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2">
          {paginatedRunbooks.map((runbook) => (
            <Card
              key={runbook.id}
              className="flex h-[104px] cursor-pointer flex-row items-center px-5 py-4 transition-colors hover:bg-accent/50"
              onClick={() =>
                navigate({ to: "/runbooks/$id", params: { id: runbook.id } })
              }
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <h3 className="truncate text-sm font-medium">
                  {runbook.title}
                </h3>
                {runbook.content && (
                  <p className="line-clamp-1 text-sm text-muted-foreground">
                    {extractExcerpt(runbook.content)}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  {runbook.tags.length > 0 && (
                    <div className="flex gap-1">
                      {runbook.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {runbook.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{runbook.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(runbook.updatedAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </div>
              </div>
              <div
                className="ml-4 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        navigate({
                          to: "/runbooks/$id",
                          params: { id: runbook.id },
                        })
                      }
                    >
                      <Pencil className="mr-2 size-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => deleteMutation.mutate(runbook.id)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {totalPages > 1 && (
        <Pagination className="pt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {getPageNumbers(currentPage, totalPages).map((page, i) =>
              page === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    isActive={page === currentPage}
                    onClick={() => setCurrentPage(page)}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
