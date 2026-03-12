import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { SkillEditorForm, type SkillEditorPayload } from '@/components/skills/skill-editor-form'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useCreateSkill } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/skills/new')({
  component: SkillCreatePage,
})

function SkillCreatePage() {
  const navigate = useNavigate()
  const createSkill = useCreateSkill()

  async function handleCreate(payload: SkillEditorPayload) {
    const created = await createSkill.mutateAsync({
      name: payload.name,
      description: payload.description,
      markdown: payload.markdown,
    })

    toast.success('Skill 已创建')
    void navigate({ to: '/skills/$slug', params: { slug: created.slug } })
  }

  return (
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
              <BreadcrumbPage>新建</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <SkillEditorForm
          mode="create"
          pending={createSkill.isPending}
          onSubmit={handleCreate}
        />
      </motion.div>
    </div>
  )
}
