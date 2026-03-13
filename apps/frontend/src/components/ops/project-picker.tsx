import type { Project } from '@chronos/shared'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getProjectDisplayName } from '@/lib/project-display'
import { cn } from '@/lib/utils'

type ProjectPickerWidth = 'responsive' | 'full'

export function ProjectPicker(props: {
  projects: Project[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  width?: ProjectPickerWidth
  className?: string
}) {
  const triggerClassName = props.width === 'full'
    ? 'w-full bg-background/70'
    : 'w-full bg-background/70 md:w-64'

  return (
    <Select value={props.value} onValueChange={props.onValueChange}>
      <SelectTrigger className={cn(triggerClassName, props.className)}>
        <SelectValue placeholder={props.placeholder ?? 'Select project'} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {props.projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {getProjectDisplayName(project)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
