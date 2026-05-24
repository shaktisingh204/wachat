import { z } from 'zod';

export const issueSubtaskSchema = z.object({
  id: z.string().or(z.number()).transform(String),
  title: z.string().default(''),
  assigneeId: z.string().or(z.number()).transform(String).optional().nullable(),
  assigneeName: z.string().optional().nullable(),
  status: z.string().default('todo'),
  dueDate: z.string().or(z.date()).transform(d => {
    if (!d) return undefined;
    const s = typeof d === 'string' ? d : d.toISOString();
    return s.slice(0, 10);
  }).optional().nullable(),
});

export const issueAttachmentSchema = z.object({
  id: z.string().or(z.number()).transform(String),
  url: z.string().default(''),
  name: z.string().default(''),
  mime: z.string().optional().nullable(),
  size: z.number().or(z.string().transform(Number)).optional().nullable(),
});

export const issueSchema = z.object({
  _id: z.string().or(z.any()).transform(String),
  projectId: z.string().or(z.any()).transform(String).optional().nullable(),
  title: z.string().default(''),
  description: z.string().optional().nullable(),
  status: z.string().default('open'),
  priority: z.string().optional().nullable(),
  severity: z.string().optional().nullable(),
  issueType: z.string().optional().nullable(),
  reporterUserId: z.string().or(z.any()).transform(String).optional().nullable(),
  reporterName: z.string().optional().nullable(),
  reporterId: z.string().or(z.any()).transform(String).optional().nullable(),
  assigneeUserId: z.string().or(z.any()).transform(String).optional().nullable(),
  assigneeName: z.string().optional().nullable(),
  assigneeId: z.string().or(z.any()).transform(String).optional().nullable(),
  dueDate: z.string().or(z.date()).transform(d => {
    if (!d) return undefined;
    const s = typeof d === 'string' ? d : d.toISOString();
    return s.slice(0, 10);
  }).optional().nullable(),
  estimatedHours: z.number().or(z.string().transform(Number)).optional().nullable(),
  subtasks: z.array(z.unknown()).transform(v => {
    const res: z.infer<typeof issueSubtaskSchema>[] = [];
    if (Array.isArray(v)) {
      for (const item of v) {
        const parsed = issueSubtaskSchema.safeParse(item);
        if (parsed.success) res.push(parsed.data);
      }
    }
    return res;
  }).optional().nullable(),
  attachments: z.array(z.unknown()).transform(v => {
    const res: z.infer<typeof issueAttachmentSchema>[] = [];
    if (Array.isArray(v)) {
      for (const item of v) {
        const parsed = issueAttachmentSchema.safeParse(item);
        if (parsed.success) res.push(parsed.data);
      }
    }
    return res;
  }).optional().nullable(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
}).passthrough();

export type ParsedIssue = z.infer<typeof issueSchema>;
