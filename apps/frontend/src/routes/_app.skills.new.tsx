import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Save } from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { useCreateSkill } from '@/lib/queries/ops'

const DEFAULT_TEMPLATE = `---
name: ""
description: ""
---

`

export const Route = createFileRoute('/_app/skills/new')({
  component: SkillCreatePage,
})

function SkillCreatePage() {
  const navigate = useNavigate()
  const createSkill = useCreateSkill()
  const [markdown, setMarkdown] = useState(DEFAULT_TEMPLATE)

  async function handleSave() {
    const created = await createSkill.mutateAsync({ markdown })
    toast.success('Skill 已创建')
    void navigate({ to: '/skills/$slug', params: { slug: created.slug } })
  }

  return (
    <div className="flex min-h-full flex-col bg-background px-4 py-4 md:px-8 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="flex flex-1 flex-col gap-4"
      >
        <div className="flex items-center justify-between">
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

          <Button onClick={handleSave} disabled={createSkill.isPending}>
            <Save data-icon="inline-start" className="size-4" />
            创建
          </Button>
        </div>

        <MarkdownEditor
          value={markdown}
          onChange={setMarkdown}
          placeholder="在 frontmatter 中填写 name 和 description，下方编写 Skill 内容"
          minHeight="calc(100vh - 180px)"
          className="flex-1"
        />
      </motion.div>
    </div>
  )
}
