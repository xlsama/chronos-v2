import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { LibraryBig, Plus } from "lucide-react";
import { motion } from "motion/react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { opsQueries, useCreateProject } from "@/lib/queries/ops";

const createProjectSchema = z.object({
  name: z.string().min(1, "请输入标题"),
  description: z.string().optional(),
});

export const Route = createFileRoute("/_app/knowledge-base/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opsQueries.projectList()),
  component: KnowledgeBaseIndexPage,
});

function KnowledgeBaseIndexPage() {
  const { data: projects } = useSuspenseQuery(opsQueries.projectList());
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const form = useForm({
    defaultValues: { name: "", description: "" },
    validators: { onSubmit: createProjectSchema },
    onSubmit: async ({ value }) => {
      const result = await createProject.mutateAsync({
        name: value.name,
        description: value.description || undefined,
      });
      setOpen(false);
      void navigate({ to: "/knowledge-base/$projectId", params: { projectId: result.id } });
    },
  });

  const visibleProjects = projects.filter((p) => p.slug !== "_global");

  return (
    <div className="min-h-full bg-background px-4 py-4 md:px-8 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className="flex flex-col gap-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium tracking-tight">知识库</h1>
          <Button onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" className="size-4" />
            新建知识库
          </Button>
        </div>

        {visibleProjects.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryBig className="size-5" />
              </EmptyMedia>
              <EmptyTitle>还没有知识库</EmptyTitle>
              <EmptyDescription>创建一个知识库项目，开始上传文档。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setOpen(true)}>新建知识库</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((project) => (
              <Link
                key={project.id}
                to="/knowledge-base/$projectId"
                params={{ projectId: project.id }}
                className="group"
              >
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    {project.description ? (
                      <CardDescription className="line-clamp-2">
                        {project.description}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{project.documentCount ?? 0} 篇文档</span>
                      <span>{dayjs(project.createdAt).format("YYYY-MM-DD")}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </motion.div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) form.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建知识库</DialogTitle>
            <DialogDescription>创建一个新的知识库项目来管理文档。</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field
                name="name"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel>标题</FieldLabel>
                      <FieldContent>
                        <Input
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          placeholder="例如：后端服务文档"
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldContent>
                    </Field>
                  );
                }}
              />
              <form.Field
                name="description"
                children={(field) => (
                  <Field>
                    <FieldLabel>描述</FieldLabel>
                    <FieldContent>
                      <Textarea
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        rows={3}
                        placeholder="可选，简要描述这个知识库的用途"
                      />
                    </FieldContent>
                  </Field>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={createProject.isPending}>
                  创建
                </Button>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
