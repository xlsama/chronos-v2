import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { SkillEditorForm, type SkillEditorPayload } from '@/components/skills/skill-editor-form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { opsQueries, useDeleteSkill, useUpdateSkill } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/skills/$slug')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opsQueries.skill(params.slug)),
  component: SkillEditPage,
})

function SkillEditPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { data: skill } = useSuspenseQuery(opsQueries.skill(slug))
  const updateSkill = useUpdateSkill()
  const deleteSkill = useDeleteSkill()

  async function handleSave(payload: SkillEditorPayload) {
    await updateSkill.mutateAsync({
      slug,
      data: {
        name: payload.name,
        description: payload.description,
        markdown: payload.markdown,
        config: {
          prompt: payload.prompt,
          applicableServiceTypes: payload.applicableServiceTypes,
          mcpServers: payload.mcpServers,
          tools: payload.tools,
        },
      },
    })

    toast.success('Skill 已保存')
  }

  async function handleDelete() {
    await deleteSkill.mutateAsync(slug)
    toast.success('Skill 已删除')
    setDeleteDialogOpen(false)
    void navigate({ to: '/skills', replace: true })
  }

  return (
    <>
      <div className="min-h-full bg-background px-4 py-4 md:px-8 md:py-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          className="flex flex-col gap-6"
        >
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/skills">Skills</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{skill.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <SkillEditorForm
            mode="edit"
            skill={skill}
            pending={updateSkill.isPending}
            deletePending={deleteSkill.isPending}
            onSubmit={handleSave}
            onDelete={() => setDeleteDialogOpen(true)}
          />
        </motion.div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 Skill？</AlertDialogTitle>
            <AlertDialogDescription>
              {`将永久删除“${skill.name}”。此操作不可撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSkill.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteSkill.isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {deleteSkill.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
