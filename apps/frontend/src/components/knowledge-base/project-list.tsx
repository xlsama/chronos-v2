import type { KbProject } from "@chronos/shared";
import { useNavigate } from "@tanstack/react-router";
import { Library } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProjectListProps {
  projects: KbProject[];
}

const MOBILE_VISIBLE_TAGS = 4;
const TABLET_VISIBLE_TAGS = 3;
const DESKTOP_VISIBLE_TAGS = 2;

function getTagVisibilityClass(index: number) {
  if (index < DESKTOP_VISIBLE_TAGS) return "";
  if (index < TABLET_VISIBLE_TAGS) return "lg:hidden";
  if (index < MOBILE_VISIBLE_TAGS) return "sm:hidden";

  return "hidden";
}

export function ProjectList({ projects }: ProjectListProps) {
  const navigate = useNavigate();

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-muted-foreground">
        <p>暂无项目</p>
        <p className="text-sm">点击"新建项目"创建第一个知识库项目</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card
          key={project.id}
          className="group h-full cursor-pointer border-0 py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          onClick={() =>
            navigate({
              to: "/knowledge-base/$projectId",
              params: { projectId: project.id },
            })
          }
        >
          <CardContent className="flex h-full flex-col p-5 sm:p-5 lg:p-4 xl:p-5">
            <div className="flex items-start gap-3 lg:gap-2.5">
              <div className="shrink-0 rounded-xl bg-primary/10 p-3 transition-colors duration-200 group-hover:bg-primary/15 sm:p-2.5 lg:p-2">
                <Library className="size-5 text-primary sm:size-5 lg:size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-base leading-snug font-medium tracking-tight text-foreground lg:text-[15px]">
                  {project.name}
                </h3>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {project.documentCount ?? 0} 篇文档
                </span>
              </div>
            </div>
            {project.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground sm:line-clamp-2 lg:text-[13px] lg:leading-5">
                {project.description}
              </p>
            )}
            {project.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 sm:gap-1.5">
                {project.tags.map((tag, index) => (
                  <Badge
                    key={`${project.id}-${tag}-${index}`}
                    variant="secondary"
                    className={cn(
                      "max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-normal text-secondary-foreground/80",
                      getTagVisibilityClass(index),
                    )}
                  >
                    {tag}
                  </Badge>
                ))}
                {project.tags.length > MOBILE_VISIBLE_TAGS && (
                  <Badge
                    variant="secondary"
                    className="rounded-md px-2 py-0.5 text-[11px] font-normal text-muted-foreground sm:hidden"
                  >
                    +{project.tags.length - MOBILE_VISIBLE_TAGS}
                  </Badge>
                )}
                {project.tags.length > TABLET_VISIBLE_TAGS && (
                  <Badge
                    variant="secondary"
                    className="hidden rounded-md px-2 py-0.5 text-[11px] font-normal text-muted-foreground sm:inline-flex lg:hidden"
                  >
                    +{project.tags.length - TABLET_VISIBLE_TAGS}
                  </Badge>
                )}
                {project.tags.length > DESKTOP_VISIBLE_TAGS && (
                  <Badge
                    variant="secondary"
                    className="hidden rounded-md px-2 py-0.5 text-[11px] font-normal text-muted-foreground lg:inline-flex"
                  >
                    +{project.tags.length - DESKTOP_VISIBLE_TAGS}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
