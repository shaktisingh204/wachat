import { z } from 'zod';
import { ObjectId } from 'mongodb';

export const awardProgramFormSchema = z.object({
  name: z.string().min(1, 'Program name is required'),
  programType: z.string().default('recognition'),
  frequency: z.string().default('monthly'),
  periodStart: z.string().optional().transform(v => v ? new Date(v) : null),
  periodEnd: z.string().optional().transform(v => v ? new Date(v) : null),
  criteria: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  pointsValue: z.coerce.number().optional().nullable(),
  cashValue: z.coerce.number().optional().nullable(),
  status: z.string().default('draft'),
});

export const awardProgramSchema = z.object({
  _id: z.custom<ObjectId | string>().optional(),
  name: z.string().min(1, 'Program name is required'),
  programType: z.string().default('recognition'),
  frequency: z.string().default('monthly'),
  periodStart: z.union([z.date(), z.string()]).optional().nullable(),
  periodEnd: z.union([z.date(), z.string()]).optional().nullable(),
  criteria: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  pointsValue: z.number().optional().nullable(),
  cashValue: z.number().optional().nullable(),
  nominations: z.array(z.any()).default([]),
  winners: z.array(z.any()).default([]),
  status: z.string().default('draft'),
  createdAt: z.union([z.date(), z.string()]).optional(),
  updatedAt: z.union([z.date(), z.string()]).optional(),
  payrollStatus: z.enum(['pending', 'processed']).optional(),
});

export type AwardProgram = z.infer<typeof awardProgramSchema>;

export const awardNominationSchema = z.object({
  nomineeName: z.string().optional(),
  nomineeId: z.string().optional(),
  nominatorName: z.string().optional(),
  nominatorId: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  submittedAt: z.union([z.date(), z.string()]).optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
});

export type AwardNomination = z.infer<typeof awardNominationSchema>;

export const awardWinnerSchema = z.object({
  employeeName: z.string().optional(),
  employeeId: z.string().optional(),
  awardedAt: z.union([z.date(), z.string()]).optional(),
  date: z.union([z.date(), z.string()]).optional(),
  citation: z.string().optional(),
  reason: z.string().optional(),
});

export type AwardWinner = z.infer<typeof awardWinnerSchema>;
