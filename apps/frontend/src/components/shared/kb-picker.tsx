import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Library, Check, X } from 'lucide-react'

import { kbQueries } from '@/lib/queries/knowledge-base'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { PromptInputAction } from '@/components/ui/prompt-input'

interface KbPickerProps {
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function KbPicker({ selected, onChange, disabled }: KbPickerProps) {
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    ...kbQueries.projectList(),
    staleTime: 5 * 60 * 1000,
  })

  const projects = data?.data ?? []

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PromptInputAction tooltip="引用知识库">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={disabled} className="relative">
            <Library className="size-5" />
            {selected.length > 0 && (
              <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium">
                {selected.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
      </PromptInputAction>
      <PopoverContent className="w-72 p-0" align="start" side="top">
        <Command>
          <CommandInput placeholder="搜索知识库项目..." />
          <CommandList>
            <CommandEmpty>没有找到知识库项目</CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  onSelect={() => toggle(project.id)}
                >
                  <div className="flex flex-1 items-center gap-2">
                    <div className="flex size-4 shrink-0 items-center justify-center">
                      {selected.includes(project.id) && <Check className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{project.name}</span>
                        {project.documentCount != null && (
                          <span className="text-muted-foreground text-xs">{project.documentCount} 篇</span>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-muted-foreground truncate text-xs">{project.description}</p>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface KbBadgeListProps {
  selected: string[]
  onChange: (ids: string[]) => void
}

export function KbBadgeList({ selected, onChange }: KbBadgeListProps) {
  const { data } = useQuery({
    ...kbQueries.projectList(),
    staleTime: 5 * 60 * 1000,
  })

  const projects = data?.data ?? []
  const selectedProjects = projects.filter((p) => selected.includes(p.id))

  if (selectedProjects.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-2 pt-2">
      {selectedProjects.map((project) => (
        <Badge key={project.id} variant="secondary" className="gap-1 pr-1">
          <Library className="size-3" />
          {project.name}
          <button
            type="button"
            className="hover:bg-muted-foreground/20 ml-0.5 rounded-sm p-0.5"
            onClick={() => onChange(selected.filter((id) => id !== project.id))}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}
