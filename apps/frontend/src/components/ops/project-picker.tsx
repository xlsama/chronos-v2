import type { Project } from '@chronos/shared'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ProjectPicker(props: {
  projects: Project[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Select value={props.value} onValueChange={props.onValueChange}>
      <SelectTrigger className="w-full min-w-64 bg-background/70">
        <SelectValue placeholder={props.placeholder ?? 'Select project'} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {props.projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
