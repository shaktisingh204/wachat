/**
 * Pre-built service templates.
 *
 * Each template is a *blueprint* — projects, milestones, and tasks
 * with relative offsets in days from project start. Calling code
 * materialises a real project by walking the blueprint and writing
 * concrete dates / ids.
 */
import type {
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from './types';

export interface TemplateMilestone {
  key: string;
  name: string;
  /** Offset in days from project start. */
  offsetDays: number;
  description?: string;
}

export interface TemplateTask {
  key: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimateHours?: number;
  startOffsetDays?: number;
  dueOffsetDays?: number;
  milestoneKey?: string;
  /** Other template task keys this task depends on. */
  dependsOn?: string[];
  labels?: string[];
}

export interface ProjectTemplate {
  key: string;
  name: string;
  category: 'web' | 'design' | 'retainer' | 'event' | 'audit' | 'content';
  description: string;
  defaultStatus: ProjectStatus;
  /** Suggested project duration in days. */
  durationDays: number;
  milestones: TemplateMilestone[];
  tasks: TemplateTask[];
}

/* ─────────── 6 templates ─────────── */

export const WEB_BUILD: ProjectTemplate = {
  key: 'web-build',
  name: 'Website Build',
  category: 'web',
  description: 'Discovery → design → build → launch flow for a marketing site.',
  defaultStatus: 'planning',
  durationDays: 60,
  milestones: [
    { key: 'm-discovery', name: 'Discovery sign-off', offsetDays: 7 },
    { key: 'm-design', name: 'Design approval', offsetDays: 21 },
    { key: 'm-staging', name: 'Staging delivered', offsetDays: 45 },
    { key: 'm-launch', name: 'Production launch', offsetDays: 60 },
  ],
  tasks: [
    {
      key: 't-kickoff',
      title: 'Kickoff workshop',
      priority: 'high',
      startOffsetDays: 0,
      dueOffsetDays: 1,
      milestoneKey: 'm-discovery',
    },
    {
      key: 't-sitemap',
      title: 'Sitemap & wireframes',
      startOffsetDays: 2,
      dueOffsetDays: 7,
      milestoneKey: 'm-discovery',
      dependsOn: ['t-kickoff'],
    },
    {
      key: 't-design',
      title: 'Visual design',
      startOffsetDays: 8,
      dueOffsetDays: 21,
      milestoneKey: 'm-design',
      dependsOn: ['t-sitemap'],
    },
    {
      key: 't-build',
      title: 'Frontend build',
      startOffsetDays: 22,
      dueOffsetDays: 42,
      milestoneKey: 'm-staging',
      dependsOn: ['t-design'],
    },
    {
      key: 't-cms',
      title: 'CMS integration',
      startOffsetDays: 30,
      dueOffsetDays: 45,
      milestoneKey: 'm-staging',
      dependsOn: ['t-build'],
    },
    {
      key: 't-launch',
      title: 'Launch & QA',
      priority: 'urgent',
      startOffsetDays: 55,
      dueOffsetDays: 60,
      milestoneKey: 'm-launch',
      dependsOn: ['t-cms'],
    },
  ],
};

export const DESIGN_SPRINT: ProjectTemplate = {
  key: 'design',
  name: 'Design Sprint',
  category: 'design',
  description: 'Five-day design sprint — understand, sketch, decide, prototype, validate.',
  defaultStatus: 'planning',
  durationDays: 7,
  milestones: [
    { key: 'm-prototype', name: 'Prototype ready', offsetDays: 4 },
    { key: 'm-validation', name: 'Validation report', offsetDays: 7 },
  ],
  tasks: [
    { key: 't-understand', title: 'Understand', dueOffsetDays: 1 },
    {
      key: 't-sketch',
      title: 'Sketch',
      dueOffsetDays: 2,
      dependsOn: ['t-understand'],
    },
    {
      key: 't-decide',
      title: 'Decide',
      dueOffsetDays: 3,
      dependsOn: ['t-sketch'],
    },
    {
      key: 't-prototype',
      title: 'Prototype',
      dueOffsetDays: 4,
      milestoneKey: 'm-prototype',
      dependsOn: ['t-decide'],
    },
    {
      key: 't-validate',
      title: 'User validation',
      dueOffsetDays: 5,
      milestoneKey: 'm-validation',
      dependsOn: ['t-prototype'],
    },
    {
      key: 't-report',
      title: 'Sprint report',
      dueOffsetDays: 7,
      milestoneKey: 'm-validation',
      dependsOn: ['t-validate'],
    },
  ],
};

export const RETAINER: ProjectTemplate = {
  key: 'retainer',
  name: 'Monthly Retainer',
  category: 'retainer',
  description: 'Recurring monthly support cycle with weekly status & reporting.',
  defaultStatus: 'active',
  durationDays: 30,
  milestones: [
    { key: 'm-month-end', name: 'Month-end report', offsetDays: 30 },
  ],
  tasks: [
    { key: 't-week1', title: 'Week 1 backlog grooming', dueOffsetDays: 2 },
    { key: 't-week2', title: 'Week 2 status call', dueOffsetDays: 9 },
    { key: 't-week3', title: 'Week 3 status call', dueOffsetDays: 16 },
    { key: 't-week4', title: 'Week 4 status call', dueOffsetDays: 23 },
    {
      key: 't-report',
      title: 'Monthly performance report',
      dueOffsetDays: 30,
      milestoneKey: 'm-month-end',
    },
  ],
};

export const EVENT: ProjectTemplate = {
  key: 'event',
  name: 'Event Production',
  category: 'event',
  description: 'Plan, promote, run, and recap a live or virtual event.',
  defaultStatus: 'planning',
  durationDays: 90,
  milestones: [
    { key: 'm-venue', name: 'Venue booked', offsetDays: 30 },
    { key: 'm-promo', name: 'Promo live', offsetDays: 45 },
    { key: 'm-show', name: 'Show day', offsetDays: 80 },
    { key: 'm-recap', name: 'Post-event recap', offsetDays: 90 },
  ],
  tasks: [
    { key: 't-brief', title: 'Event brief', dueOffsetDays: 7 },
    {
      key: 't-venue',
      title: 'Venue selection & booking',
      dueOffsetDays: 30,
      milestoneKey: 'm-venue',
      dependsOn: ['t-brief'],
    },
    {
      key: 't-promo',
      title: 'Promo & registration site',
      dueOffsetDays: 45,
      milestoneKey: 'm-promo',
      dependsOn: ['t-venue'],
    },
    {
      key: 't-runsheet',
      title: 'Run sheet & rehearsal',
      dueOffsetDays: 78,
      dependsOn: ['t-promo'],
    },
    {
      key: 't-show',
      title: 'Show day execution',
      priority: 'urgent',
      dueOffsetDays: 80,
      milestoneKey: 'm-show',
      dependsOn: ['t-runsheet'],
    },
    {
      key: 't-recap',
      title: 'Recap deck & metrics',
      dueOffsetDays: 90,
      milestoneKey: 'm-recap',
      dependsOn: ['t-show'],
    },
  ],
};

export const AUDIT: ProjectTemplate = {
  key: 'audit',
  name: 'SEO / Site Audit',
  category: 'audit',
  description: 'Crawl, analyse, recommend, present — a one-shot audit engagement.',
  defaultStatus: 'active',
  durationDays: 21,
  milestones: [
    { key: 'm-findings', name: 'Findings draft', offsetDays: 14 },
    { key: 'm-presentation', name: 'Client presentation', offsetDays: 21 },
  ],
  tasks: [
    { key: 't-crawl', title: 'Site crawl', dueOffsetDays: 3 },
    {
      key: 't-analysis',
      title: 'Quantitative analysis',
      dueOffsetDays: 10,
      dependsOn: ['t-crawl'],
    },
    {
      key: 't-findings',
      title: 'Findings draft',
      dueOffsetDays: 14,
      milestoneKey: 'm-findings',
      dependsOn: ['t-analysis'],
    },
    {
      key: 't-recommendations',
      title: 'Recommendations & roadmap',
      dueOffsetDays: 18,
      dependsOn: ['t-findings'],
    },
    {
      key: 't-present',
      title: 'Client presentation',
      dueOffsetDays: 21,
      milestoneKey: 'm-presentation',
      dependsOn: ['t-recommendations'],
    },
  ],
};

export const CONTENT: ProjectTemplate = {
  key: 'content',
  name: 'Content Production',
  category: 'content',
  description: 'Editorial pipeline from brief through publication.',
  defaultStatus: 'active',
  durationDays: 14,
  milestones: [
    { key: 'm-publish', name: 'Publication', offsetDays: 14 },
  ],
  tasks: [
    { key: 't-brief', title: 'Editorial brief', dueOffsetDays: 1 },
    {
      key: 't-outline',
      title: 'Outline',
      dueOffsetDays: 3,
      dependsOn: ['t-brief'],
    },
    {
      key: 't-draft',
      title: 'First draft',
      dueOffsetDays: 7,
      dependsOn: ['t-outline'],
    },
    {
      key: 't-edit',
      title: 'Edit & polish',
      dueOffsetDays: 10,
      dependsOn: ['t-draft'],
    },
    {
      key: 't-design',
      title: 'Hero & inline assets',
      dueOffsetDays: 11,
      dependsOn: ['t-outline'],
    },
    {
      key: 't-publish',
      title: 'Publish',
      dueOffsetDays: 14,
      milestoneKey: 'm-publish',
      dependsOn: ['t-edit', 't-design'],
    },
  ],
};

export const TEMPLATES: ProjectTemplate[] = [
  WEB_BUILD,
  DESIGN_SPRINT,
  RETAINER,
  EVENT,
  AUDIT,
  CONTENT,
];

export function getTemplate(key: string): ProjectTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

export function listTemplates(): Array<Pick<ProjectTemplate, 'key' | 'name' | 'category' | 'description' | 'durationDays'>> {
  return TEMPLATES.map(({ key, name, category, description, durationDays }) => ({
    key,
    name,
    category,
    description,
    durationDays,
  }));
}

/** Resolve template offsets to absolute ISO dates given a project start. */
export function materialiseDates(
  template: ProjectTemplate,
  projectStart: string,
): {
  projectDueDate: string;
  milestones: Array<{ key: string; name: string; dueDate: string; description?: string }>;
  tasks: Array<{
    key: string;
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    estimateHours?: number;
    startDate?: string;
    dueDate?: string;
    milestoneKey?: string;
    dependsOn?: string[];
    labels?: string[];
  }>;
} {
  const startMs = Date.parse(projectStart);
  if (Number.isNaN(startMs)) throw new Error('Invalid projectStart');
  const day = 24 * 60 * 60 * 1000;
  const at = (offset?: number): string | undefined =>
    offset == null ? undefined : new Date(startMs + offset * day).toISOString();

  return {
    projectDueDate: new Date(startMs + template.durationDays * day).toISOString(),
    milestones: template.milestones.map((m) => ({
      key: m.key,
      name: m.name,
      description: m.description,
      dueDate: at(m.offsetDays) as string,
    })),
    tasks: template.tasks.map((t) => ({
      key: t.key,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      estimateHours: t.estimateHours,
      startDate: at(t.startOffsetDays),
      dueDate: at(t.dueOffsetDays),
      milestoneKey: t.milestoneKey,
      dependsOn: t.dependsOn,
      labels: t.labels,
    })),
  };
}
