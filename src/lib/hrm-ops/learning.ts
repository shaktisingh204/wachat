/**
 * Learning & Development — course assignment, completion tracking,
 * certification expiry monitoring.
 */

import type { Certification, Course, Employee, ID } from './types';

export interface CourseAssignment {
  id: ID;
  tenantId: ID;
  courseId: ID;
  employeeId: ID;
  assignedAt: string;
  dueAt?: string;
  completedAt?: string;
  progress: number; // 0..100
  status: 'assigned' | 'in-progress' | 'completed' | 'overdue';
}

export function assignCourse(
  course: Course,
  employee: Pick<Employee, 'id' | 'tenantId'>,
  opts: { dueInDays?: number; assignedAt?: Date } = {},
): CourseAssignment {
  const assignedAt = opts.assignedAt ?? new Date();
  const dueAt = opts.dueInDays
    ? new Date(assignedAt.getTime() + opts.dueInDays * 86_400_000).toISOString()
    : undefined;
  return {
    id: `ca_${employee.id}_${course.id}`,
    tenantId: employee.tenantId,
    courseId: course.id,
    employeeId: employee.id,
    assignedAt: assignedAt.toISOString(),
    dueAt,
    progress: 0,
    status: 'assigned',
  };
}

export function recordProgress(
  assignment: CourseAssignment,
  progress: number,
  now: Date = new Date(),
): CourseAssignment {
  const clamped = Math.min(100, Math.max(0, progress));
  const completed = clamped >= 100;
  const overdue = assignment.dueAt && new Date(assignment.dueAt) < now && !completed;
  return {
    ...assignment,
    progress: clamped,
    completedAt: completed ? now.toISOString() : assignment.completedAt,
    status: completed ? 'completed' : overdue ? 'overdue' : clamped > 0 ? 'in-progress' : 'assigned',
  };
}

export function issueCertification(
  course: Course,
  employee: Pick<Employee, 'id' | 'tenantId'>,
  opts: { issuedAt?: Date; validForMonths?: number; credentialId?: string } = {},
): Certification {
  const issuedAt = opts.issuedAt ?? new Date();
  const expiresAt = opts.validForMonths
    ? new Date(issuedAt.getTime()).toISOString().slice(0, 10)
    : undefined;
  if (opts.validForMonths) {
    const d = new Date(issuedAt);
    d.setMonth(d.getMonth() + opts.validForMonths);
    return {
      id: `cert_${employee.id}_${course.id}`,
      tenantId: employee.tenantId,
      employeeId: employee.id,
      courseId: course.id,
      name: course.title,
      issuer: course.provider,
      issuedAt: issuedAt.toISOString(),
      expiresAt: d.toISOString(),
      credentialId: opts.credentialId,
    };
  }
  return {
    id: `cert_${employee.id}_${course.id}`,
    tenantId: employee.tenantId,
    employeeId: employee.id,
    courseId: course.id,
    name: course.title,
    issuer: course.provider,
    issuedAt: issuedAt.toISOString(),
    expiresAt,
    credentialId: opts.credentialId,
  };
}

export interface ExpiryAlert {
  certificationId: ID;
  employeeId: ID;
  daysUntilExpiry: number;
  severity: 'expired' | 'expiring' | 'soon' | 'ok';
}

export function findExpiringCertifications(
  certs: Certification[],
  now: Date = new Date(),
  thresholdDays = 30,
): ExpiryAlert[] {
  return certs
    .filter((c) => c.expiresAt)
    .map((c) => {
      const exp = new Date(c.expiresAt!);
      const daysUntilExpiry = Math.ceil((exp.getTime() - now.getTime()) / 86_400_000);
      const severity: ExpiryAlert['severity'] =
        daysUntilExpiry < 0 ? 'expired' : daysUntilExpiry <= 7 ? 'expiring' : daysUntilExpiry <= thresholdDays ? 'soon' : 'ok';
      return { certificationId: c.id, employeeId: c.employeeId, daysUntilExpiry, severity };
    })
    .filter((a) => a.severity !== 'ok');
}
