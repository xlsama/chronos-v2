import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FilePlus, Upload, Pencil, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentList } from "@/components/knowledge-base/document-list";
import { DocumentUploadDialog } from "@/components/knowledge-base/document-upload-dialog";
import { ProjectFormDialog } from "@/components/knowledge-base/project-form-dialog";
import { kbQueries, useDeleteProject, useCreateDocument } from "@/lib/queries/knowledge-base";

export const Route = createFileRoute("/_app/knowledge-base/$projectId/")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { data: project } = useSuspenseQuery(kbQueries.projectDetail(projectId));
  const { data: documents } = useSuspenseQuery(kbQueries.documentList(projectId));

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const deleteMutation = useDeleteProject();
  const createDocMutation = useCreateDocument();

  const handleDelete = () => {
    deleteMutation.mutate(projectId, {
      onSuccess: () => navigate({ to: "/knowledge-base" }),
    });
  };

  const handleCreateMarkdown = () => {
    createDocMutation.mutate(
      { projectId, title: "新文档", content: "" },
      {
        onSuccess: (doc) =>
          navigate({
            to: "/knowledge-base/$projectId/$docId",
            params: { projectId, docId: doc.id },
          }),
      },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-6 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/knowledge-base">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-medium">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {project.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确定删除该项目？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作不可撤销。所有文档将一并删除。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <FilePlus className="size-4" />
                新建文档
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCreateMarkdown}>
                Markdown 文档
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 size-4" />
                上传文件
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-6 pb-6">
        <DocumentList documents={documents} projectId={projectId} />
      </div>
      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={projectId}
      />
      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />
    </div>
  );
}
