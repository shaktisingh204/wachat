/**
 * Onboarding — pre-built 7-day onboarding program executable via SabFlow.
 *
 * `buildSevenDayProgram` returns an ordered list of `OnboardingStep`s that
 * can be materialised into Sabflow runs (each step optionally referencing a
 * sabflow workflow id).
 */

import type { Employee, OnboardingStep, OffboardingStep, ID } from './types';

export interface SevenDayOptions {
  programId?: ID;
  managerId?: ID;
  itContactId?: ID;
  hrContactId?: ID;
  /** Map of step keys to existing sabflow workflow ids to trigger. */
  sabflowMap?: Partial<Record<string, ID>>;
}

const TEMPLATE: Array<Omit<OnboardingStep, 'id' | 'tenantId' | 'programId' | 'employeeId' | 'status'> & {
  key: string;
}> = [
  {
    key: 'welcome-email',
    dayOffset: -3,
    title: 'Send pre-boarding welcome email',
    description: 'Logistics, first-day plan, dress code, who they will meet.',
    owner: 'hr',
    channel: 'email',
  },
  {
    key: 'it-provisioning',
    dayOffset: -1,
    title: 'Provision laptop and accounts',
    description: 'Email, Slack, Github, SSO, VPN, code repos.',
    owner: 'it',
    channel: 'task',
  },
  {
    key: 'day-1-orientation',
    dayOffset: 0,
    title: 'Day 1 orientation',
    description: 'Office tour or virtual welcome, paperwork, ID badge.',
    owner: 'hr',
    channel: 'meeting',
  },
  {
    key: 'manager-1on1',
    dayOffset: 0,
    title: 'Welcome 1:1 with manager',
    description: '30 min: introductions, expectations, week 1 plan.',
    owner: 'manager',
    channel: 'meeting',
  },
  {
    key: 'team-intro',
    dayOffset: 1,
    title: 'Team introduction & workspace tour',
    description: 'Meet teammates, shadow standup, walk through tooling.',
    owner: 'manager',
    channel: 'meeting',
  },
  {
    key: 'compliance-training',
    dayOffset: 2,
    title: 'Mandatory compliance training',
    description: 'Code of conduct, info-sec, anti-harassment, GDPR.',
    owner: 'hr',
    channel: 'sabflow',
  },
  {
    key: 'role-handbook',
    dayOffset: 3,
    title: 'Role handbook & first ticket',
    description: 'Read role docs, pick up a first task with a buddy.',
    owner: 'manager',
    channel: 'task',
  },
  {
    key: 'benefits-enrollment',
    dayOffset: 4,
    title: 'Benefits enrollment',
    description: 'Health, retirement, perks, expense card.',
    owner: 'finance',
    channel: 'sabflow',
  },
  {
    key: 'first-week-retro',
    dayOffset: 5,
    title: 'End-of-week retro with manager',
    description: 'Reflect on week 1 and adjust week 2 plan.',
    owner: 'manager',
    channel: 'meeting',
  },
  {
    key: 'week2-checkin',
    dayOffset: 6,
    title: 'HR check-in survey',
    description: '5-question pulse survey on onboarding experience.',
    owner: 'hr',
    channel: 'sabflow',
  },
];

export function buildSevenDayProgram(
  employee: Pick<Employee, 'id' | 'tenantId'>,
  opts: SevenDayOptions = {},
): OnboardingStep[] {
  const programId = opts.programId ?? `prog_7day_${employee.id}`;
  return TEMPLATE.map((t) => ({
    id: `onb_${employee.id}_${t.key}`,
    tenantId: employee.tenantId,
    programId,
    employeeId: employee.id,
    dayOffset: t.dayOffset,
    title: t.title,
    description: t.description,
    owner: t.owner,
    channel: t.channel,
    sabflowId: opts.sabflowMap?.[t.key],
    status: 'pending',
  }));
}

/**
 * Convert an onboarding program to SabFlow execution descriptors, ready to
 * be enqueued by the orchestrator. Each step that has a sabflow workflow
 * mapped becomes a `runWorkflow` action; others are tasks for the assignee.
 */
export interface SabflowExecutionPlan {
  employeeId: ID;
  steps: Array<
    | { kind: 'workflow'; runAtOffsetDays: number; sabflowId: ID; payload: Record<string, unknown> }
    | { kind: 'task'; runAtOffsetDays: number; owner: OnboardingStep['owner']; title: string }
  >;
}

export function toSabflowPlan(steps: OnboardingStep[]): SabflowExecutionPlan {
  const employeeId = steps[0]?.employeeId ?? '';
  return {
    employeeId,
    steps: steps.map((s) =>
      s.sabflowId
        ? {
            kind: 'workflow',
            runAtOffsetDays: s.dayOffset,
            sabflowId: s.sabflowId,
            payload: { employeeId: s.employeeId, programId: s.programId, stepId: s.id },
          }
        : { kind: 'task', runAtOffsetDays: s.dayOffset, owner: s.owner, title: s.title },
    ),
  };
}

export function buildOffboardingPlan(
  employee: Pick<Employee, 'id' | 'tenantId'>,
  lastWorkingDate: Date,
): OffboardingStep[] {
  const tasks: Array<Omit<OffboardingStep, 'id' | 'tenantId' | 'employeeId' | 'status'>> = [
    { dayOffset: -14, title: 'Acknowledge resignation, plan handover', owner: 'manager' },
    { dayOffset: -10, title: 'Knowledge transfer document', owner: 'employee' },
    { dayOffset: -5, title: 'Asset return checklist', owner: 'it' },
    { dayOffset: -2, title: 'Final settlement preparation', owner: 'finance' },
    { dayOffset: -1, title: 'Exit interview', owner: 'hr' },
    { dayOffset: 0, title: 'Deactivate accounts and revoke access', owner: 'it' },
    { dayOffset: 0, title: 'Issue experience letter & relieving letter', owner: 'hr' },
  ];
  void lastWorkingDate; // step dates can be computed by orchestrator
  return tasks.map((t, i) => ({
    id: `off_${employee.id}_${i}`,
    tenantId: employee.tenantId,
    employeeId: employee.id,
    dayOffset: t.dayOffset,
    title: t.title,
    owner: t.owner,
    status: 'pending',
  }));
}
