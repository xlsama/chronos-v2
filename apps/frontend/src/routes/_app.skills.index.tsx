import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { opsQueries } from '@/lib/queries/ops'

export const Route = createFileRoute('/_app/skills/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(opsQueries.skills()),
  component: SkillsIndexPage,
})

function SkillsIndexPage() {
  const { data: skills } = useSuspenseQuery(opsQueries.skills())
  const visibleSkills = [...skills].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))

  return (
    <div className="min-h-full bg-background px-4 py-4 md:px-8 md:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-medium tracking-tight">Skills</h1>
            <p className="text-sm text-muted-foreground">按卡片浏览所有 Skill，点击后进入独立编辑页。</p>
          </div>
          <Button asChild>
            <Link to="/skills/new">
              <Plus data-icon="inline-start" className="size-4" />
              新建 Skill
            </Link>
          </Button>
        </div>

        {visibleSkills.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sparkles className="size-5" />
              </EmptyMedia>
              <EmptyTitle>还没有 Skill</EmptyTitle>
              <EmptyDescription>创建一个 Skill，编写 Markdown 指南。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to="/skills/new">新建 Skill</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSkills.map((skill) => (
              <Link
                key={skill.slug}
                to="/skills/$slug"
                params={{ slug: skill.slug }}
                className="group"
              >
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <CardTitle className="text-lg">{skill.name}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-10">
                      {skill.description || '暂无描述'}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
