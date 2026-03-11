import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { ConnectionImportCandidate } from '@chronos/shared'
import {
  Check,
  ChevronsUpDown,
  Library,
  Loader2,
  Sparkles,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { connectionConfigFields } from '@/lib/schemas/connection'
import { cn } from '@/lib/utils'
import { kbQueries } from '@/lib/queries/knowledge-base'
import {
  useCommitConnectionsFromKb,
  usePreviewConnectionsFromKb,
} from '@/lib/queries/connections'
import { getConnectionMeta } from '@/lib/constants/connection-types'

interface ConnectionImportDialogProps {
  trigger: React.ReactNode
  navigateToConnectionsOnSuccess?: boolean
}

function getFieldLabel(type: ConnectionImportCandidate['type'], key: string) {
  return connectionConfigFields[type]?.find((field) => field.key === key)?.label ?? key
}

function formatConfidence(confidence: number | null) {
  if (confidence == null) return null
  return `${Math.round(confidence * 100)}%`
}

export function ConnectionImportDialog({
  trigger,
  navigateToConnectionsOnSuccess = false,
}: ConnectionImportDialogProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data: projectData } = useQuery({
    ...kbQueries.projectList(),
    staleTime: 5 * 60 * 1000,
  })

  const previewMutation = usePreviewConnectionsFromKb()
  const commitMutation = useCommitConnectionsFromKb()

  const projects = projectData?.data ?? []
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const preview = previewMutation.data ?? null
  const imports = preview?.imports ?? []

  useEffect(() => {
    if (!open) {
      setProjectPickerOpen(false)
      setSelectedIds([])
      previewMutation.reset()
      commitMutation.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const counts = useMemo(() => {
    const incomplete = imports.filter((item) => !item.hasAllRequiredFields).length
    return {
      total: imports.length,
      incomplete,
      selected: selectedIds.length,
    }
  }, [imports, selectedIds.length])

  const allSelected = imports.length > 0 && selectedIds.length === imports.length

  const toggleItem = (candidateId: string, checked: boolean) => {
    setSelectedIds((current) => (
      checked
        ? [...new Set([...current, candidateId])]
        : current.filter((id) => id !== candidateId)
    ))
  }

  const handleAnalyze = () => {
    if (!selectedProjectId) return
    previewMutation.mutate(
      { kbProjectId: selectedProjectId },
      {
        onSuccess: (data) => {
          setSelectedIds(data.imports.map((item) => item.id))
          if (data.imports.length === 0) {
            toast('没有识别到可导入连接', {
              description: '可以继续完善知识库文档后重新分析。',
            })
          }
        },
        onError: (error) => {
          toast.error('知识库分析失败', { description: error.message })
        },
      },
    )
  }

  const handleImport = () => {
    if (!preview || selectedIds.length === 0) return

    commitMutation.mutate(
      {
        kbProjectId: preview.kbProjectId,
        imports: preview.imports,
        selectedIds,
      },
      {
        onSuccess: (result) => {
          const parts = [
            `成功 ${result.created.length} 条`,
            result.failed.length > 0 ? `失败 ${result.failed.length} 条` : null,
            result.skipped.length > 0 ? `跳过 ${result.skipped.length} 条` : null,
          ].filter(Boolean)

          if (result.created.length > 0) {
            toast.success('知识库导入完成', {
              description: `${parts.join('，')}。请继续 review 并测试连接。`,
            })
            setOpen(false)
            if (navigateToConnectionsOnSuccess) {
              navigate({ to: '/connections' })
            }
            return
          }

          toast.error('没有导入任何连接', {
            description: parts.join('，') || '本次没有创建新的连接。',
          })
        },
        onError: (error) => {
          toast.error('知识库导入失败', { description: error.message })
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <WandSparkles className="size-5 text-amber-500" />
            从知识库导入服务
          </DialogTitle>
          <DialogDescription>
            选择一个知识库项目后，系统会分析已处理文档中的服务配置，并生成可批量导入的连接候选。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-hidden px-6 py-5">
          <Card className="border-dashed bg-muted/30 py-0">
            <CardContent className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-end">
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium">知识库项目</div>
                <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between md:max-w-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Library className="size-4 text-muted-foreground" />
                        <span className="truncate">
                          {selectedProject?.name ?? '搜索并选择知识库项目'}
                        </span>
                      </span>
                      <ChevronsUpDown className="size-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="min-w-80 w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="搜索知识库项目..." />
                      <CommandList>
                        <CommandEmpty>没有找到知识库项目</CommandEmpty>
                        <CommandGroup>
                          {projects.map((project) => (
                            <CommandItem
                              key={project.id}
                              value={`${project.name} ${project.description ?? ''}`}
                              onSelect={() => {
                                setSelectedProjectId(project.id)
                                setSelectedIds([])
                                previewMutation.reset()
                                setProjectPickerOpen(false)
                              }}
                            >
                              <div className="flex flex-1 items-center gap-2">
                                <div className="flex size-4 items-center justify-center">
                                  {selectedProjectId === project.id && <Check className="size-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium">{project.name}</div>
                                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                    {project.documentCount != null && <span>{project.documentCount} 篇文档</span>}
                                    {project.description && <span className="truncate">{project.description}</span>}
                                  </div>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={!selectedProjectId || previewMutation.isPending}
                className="min-w-36"
              >
                {previewMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                分析并生成候选
              </Button>
            </CardContent>
          </Card>

          {preview && (
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="py-0">
                <CardContent className="px-5 py-4">
                  <div className="text-muted-foreground text-xs">识别候选</div>
                  <div className="mt-1 text-2xl font-semibold">{counts.total}</div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {preview.readyDocumentCount}/{preview.totalDocumentCount} 篇文档参与分析
                  </div>
                </CardContent>
              </Card>
              <Card className="py-0">
                <CardContent className="px-5 py-4">
                  <div className="text-muted-foreground text-xs">待导入</div>
                  <div className="mt-1 text-2xl font-semibold">{counts.selected}</div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    默认已全选，可取消不想导入的服务
                  </div>
                </CardContent>
              </Card>
              <Card className="py-0">
                <CardContent className="px-5 py-4">
                  <div className="text-muted-foreground text-xs">信息不完整</div>
                  <div className="mt-1 text-2xl font-semibold">{counts.incomplete}</div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    可先导入为草稿，后续在连接详情里补全
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {preview?.warnings.length ? (
            <Alert>
              <TriangleAlert className="size-4 text-amber-500" />
              <AlertTitle>分析提示</AlertTitle>
              <AlertDescription>
                {preview.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-card">
            {preview ? (
              preview.imports.length > 0 ? (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b px-5 py-3">
                    <label className="flex items-center gap-3 text-sm font-medium">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => setSelectedIds(checked ? imports.map((item) => item.id) : [])}
                      />
                      全选候选
                    </label>
                    <div className="text-muted-foreground text-xs">
                      项目：{preview.projectName}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="space-y-3">
                      {imports.map((candidate) => {
                        const meta = getConnectionMeta(candidate.type)
                        const checked = selectedIds.includes(candidate.id)
                        return (
                            <Card
                              key={candidate.id}
                              className={cn(
                                'py-0 transition-colors',
                                checked ? 'border-primary/40 bg-primary/5' : 'bg-background',
                              )}
                            >
                            <CardContent className="space-y-4 px-5 py-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => toggleItem(candidate.id, value === true)}
                                    className="mt-1"
                                  />
                                  <div className="rounded-lg bg-muted p-2.5">
                                    <img src={meta.icon} alt={meta.label} className="size-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-semibold">{candidate.name}</div>
                                      <Badge variant="secondary">{meta.label}</Badge>
                                      <Badge variant={candidate.hasAllRequiredFields ? 'outline' : 'secondary'}>
                                        {candidate.hasAllRequiredFields ? '完整可导入' : '信息不完整'}
                                      </Badge>
                                      {formatConfidence(candidate.confidence) && (
                                        <Badge variant="outline">
                                          置信度 {formatConfidence(candidate.confidence)}
                                        </Badge>
                                      )}
                                    </div>
                                    {candidate.sourceExcerpt && (
                                      <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                                        {candidate.sourceExcerpt}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {candidate.duplicateConnectionNames.length > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-200 bg-amber-50 text-amber-700"
                                  >
                                    已有同名连接
                                  </Badge>
                                )}
                              </div>

                              <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-muted-foreground">已识别字段</div>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(candidate.config).length > 0 ? (
                                      Object.entries(candidate.config).map(([key, value]) => (
                                        <Badge key={key} variant="outline" className="max-w-full">
                                          <span className="truncate">
                                            {getFieldLabel(candidate.type, key)}: {value}
                                          </span>
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-muted-foreground text-xs">没有识别到可用字段</span>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-muted-foreground">缺失字段</div>
                                  <div className="flex flex-wrap gap-2">
                                    {candidate.missingFields.length > 0 ? (
                                      candidate.missingFields.map((field) => (
                                        <Badge key={field} variant="secondary">
                                          {getFieldLabel(candidate.type, field)}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-muted-foreground text-xs">字段完整</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {(candidate.sourceDocuments.length > 0 || candidate.warnings.length > 0) && (
                                <>
                                  <Separator />
                                  <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                                    <div className="space-y-2">
                                      <div className="text-xs font-medium text-muted-foreground">来源文档</div>
                                      <div className="flex flex-wrap gap-2">
                                        {candidate.sourceDocuments.map((document) => (
                                          <Badge key={document.id} variant="outline">
                                            {document.title}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="text-xs font-medium text-muted-foreground">提示</div>
                                      <div className="flex flex-wrap gap-2">
                                        {candidate.warnings.length > 0 ? (
                                          candidate.warnings.map((warning) => (
                                            <Badge key={warning} variant="secondary">
                                              {warning}
                                            </Badge>
                                          ))
                                        ) : (
                                          <span className="text-muted-foreground text-xs">没有额外提示</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  当前知识库没有识别出可导入的连接。可以完善文档里的服务名称、类型、主机、账号密码等字段后重试。
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                先选择知识库项目，再点击“分析并生成候选”。
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="text-muted-foreground text-sm">
            {preview
              ? `已选择 ${selectedIds.length} / ${imports.length} 个候选`
              : '导入前会先展示识别结果供你 review'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleImport}
              disabled={!preview || selectedIds.length === 0 || commitMutation.isPending}
            >
              {commitMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              一键导入
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
