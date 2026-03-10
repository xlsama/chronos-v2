import { z } from 'zod/v4'

export const runbookFormSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  tags: z.array(z.string()).default([]),
})

export type RunbookFormValues = z.infer<typeof runbookFormSchema>
