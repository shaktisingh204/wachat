import { z } from 'zod';

export const ATSApplicationSchema = z.object({
  _id: z.string().optional(),
  candidateName: z.string().min(1, 'Candidate name is required'),
  role: z.string().min(1, 'Role is required'),
  status: z.enum(['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']).default('New'),
  appliedDate: z.string().min(1, 'Applied date is required'),
});
export type ATSApplication = z.infer<typeof ATSApplicationSchema>;

export const OnboardingTaskSchema = z.object({
  _id: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  taskName: z.string().min(1, 'Task name is required'),
  isCompleted: z.boolean().default(false),
  dueDate: z.string().min(1, 'Due date is required'),
});
export type OnboardingTask = z.infer<typeof OnboardingTaskSchema>;

export const PerformanceReviewSchema = z.object({
  _id: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  reviewerId: z.string().min(1, 'Reviewer ID is required'),
  score: z.coerce.number().min(0).max(5),
  comments: z.string().min(1, 'Comments are required'),
  reviewDate: z.string().min(1, 'Review date is required'),
});
export type PerformanceReview = z.infer<typeof PerformanceReviewSchema>;

export const OKRSchema = z.object({
  _id: z.string().optional(),
  objective: z.string().min(1, 'Objective is required'),
  keyResult: z.string().min(1, 'Key result is required'),
  progress: z.coerce.number().min(0).max(100),
  ownerId: z.string().min(1, 'Owner ID is required'),
  quarter: z.string().min(1, 'Quarter is required'),
});
export type OKR = z.infer<typeof OKRSchema>;

export const ExpenseClaimSchema = z.object({
  _id: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  amount: z.coerce.number().min(0),
  category: z.string().min(1, 'Category is required'),
  status: z.enum(['Pending', 'Approved', 'Rejected']).default('Pending'),
  dateSubmitted: z.string().min(1, 'Date submitted is required'),
});
export type ExpenseClaim = z.infer<typeof ExpenseClaimSchema>;

export const AttendanceRecordSchema = z.object({
  _id: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  date: z.string().min(1, 'Date is required'),
  checkInTime: z.string().min(1, 'Check-in time is required'),
  checkOutTime: z.string().optional(),
  isGeofenced: z.boolean().default(false),
  location: z.string().optional(),
});
export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;

export const OffboardingTaskSchema = z.object({
  _id: z.string().optional(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  taskName: z.string().min(1, 'Task name is required'),
  isCompleted: z.boolean().default(false),
  dueDate: z.string().min(1, 'Due date is required'),
});
export type OffboardingTask = z.infer<typeof OffboardingTaskSchema>;

export const TrainingCourseSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  enrolledCount: z.coerce.number().default(0),
  durationHours: z.coerce.number().min(0),
});
export type TrainingCourse = z.infer<typeof TrainingCourseSchema>;

export const BenefitPlanSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  provider: z.string().min(1, 'Provider is required'),
  coverageDetails: z.string().optional(),
  costToEmployee: z.coerce.number().min(0),
});
export type BenefitPlan = z.infer<typeof BenefitPlanSchema>;

export const OrgChartNodeSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  role: z.string().min(1, 'Role is required'),
  managerId: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
});
export type OrgChartNode = z.infer<typeof OrgChartNodeSchema>;
