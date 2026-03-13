import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownEditorPageShell } from '@/components/ops/markdown-editor-page-shell'
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
    <MarkdownEditorPageShell
      header={
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
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
              <p className="text-sm text-muted-foreground">
                先在 frontmatter 中填写 `name` 和 `description`，再继续编写 Skill 内容。
              </p>
            </div>

            <Button onClick={handleSave} disabled={createSkill.isPending}>
              <Save data-icon="inline-start" className="size-4" />
              创建
            </Button>
          </div>
        </div>
      }
    >
      <MarkdownEditor
        value={markdown}
        onChange={setMarkdown}
        placeholder="在 frontmatter 中填写 name 和 description，下方编写 Skill 内容"
        fullHeight
        className="flex-1"
      />
    </MarkdownEditorPageShell>
  )
}
