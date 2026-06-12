'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  Database,
  UserPlus,
  Workflow,
  Upload,
  ArrowRight,
  PartyPopper,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';

import {
  Button,
  Checkbox,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Progress,
} from '@/components/sabcrm/20ui';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './getting-started.css';

/**
 * SabCRM — Getting Started (`/sabcrm/getting-started`), 20ui.
 *
 * An onboarding checklist. Each step is a card (icon, title, description, a
 * "Do it" deep-link and a checkbox). Ticking a step persists its completion to
 * `localStorage` so progress survives reloads. A progress bar at the top
 * reflects `n / total` done.
 *
 * 20ui only: chrome comes from `@/components/sabcrm/20ui` (PageHeader,
 * Checkbox, Progress, Button) plus the page-local `.gs-*` classes in
 * `getting-started.css`, scoped to the 20ui root.
 */

type ChecklistStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const STEPS: readonly ChecklistStep[] = [
  {
    id: 'company',
    title: 'Create your first company',
    description:
      'Add an organisation you work with. Companies anchor the people, deals and notes that follow.',
    href: '/sabcrm/companies',
    icon: Building2,
  },
  {
    id: 'person',
    title: 'Add a person',
    description:
      'Capture a contact — your main point of contact at a company or an individual lead.',
    href: '/sabcrm/people',
    icon: Users,
  },
  {
    id: 'opportunity',
    title: 'Create an opportunity',
    description:
      'Track a deal through your pipeline, from first conversation to closed-won.',
    href: '/sabcrm/leads',
    icon: Briefcase,
  },
  {
    id: 'data-model',
    title: 'Customize your data model',
    description:
      'Add custom objects and fields so SabCRM mirrors exactly how your business works.',
    href: '/dashboard/settings/crm/data-model',
    icon: Database,
  },
  {
    id: 'invite',
    title: 'Invite a teammate',
    description:
      "Bring your team on board so everyone's working from the same source of truth.",
    href: '/dashboard/settings/crm/members',
    icon: UserPlus,
  },
  {
    id: 'workflow',
    title: 'Set up a workflow',
    description:
      'Automate repetitive steps — trigger actions when records are created or updated.',
    href: '/dashboard/settings/crm/automations',
    icon: Workflow,
  },
  {
    id: 'import',
    title: 'Import your data',
    description:
      'Bring existing companies and contacts in from a CSV to get up and running fast.',
    href: '/dashboard/settings/crm/import-export',
    icon: Upload,
  },
] as const;

const STORAGE_KEY = 'sabcrm.getting-started.completed';

/** Safely read the persisted set of completed step ids from localStorage. */
function readCompleted(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, boolean> = {};
    for (const step of STEPS) {
      if ((parsed as Record<string, unknown>)[step.id] === true) {
        out[step.id] = true;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export default function GettingStartedPage(): React.JSX.Element {
  const [completed, setCompleted] = React.useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = React.useState(false);

  // Load persisted state on mount (client only — avoids SSR hydration mismatch).
  React.useEffect(() => {
    setCompleted(readCompleted());
    setHydrated(true);
  }, []);

  // Persist on every change, once we've hydrated from storage.
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    } catch {
      /* storage unavailable (private mode / quota) — fail silently */
    }
  }, [completed, hydrated]);

  const toggle = React.useCallback((id: string) => {
    setCompleted((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  }, []);

  const reset = React.useCallback(() => setCompleted({}), []);

  const total = STEPS.length;
  // Only count once hydrated so the bar doesn't flash 0 → n on load.
  const doneCount = hydrated
    ? STEPS.reduce((n, s) => n + (completed[s.id] ? 1 : 0), 0)
    : 0;
  const allDone = doneCount === total;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <div className="gs-page">
      <div className="gs-page__inner">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Getting Started</PageTitle>
            <PageDescription>
              A few quick steps to set up SabCRM. Tick each one off as you go —
              your progress is saved on this device.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>

        {/* Progress */}
        <section className="gs-progress" aria-label="Onboarding progress">
          <div className="gs-progress__head">
            <span className="gs-progress__title">Your progress</span>
            <span className="gs-progress__count">
              <strong>{doneCount}</strong> of {total} complete
            </span>
          </div>
          <Progress
            value={pct}
            tone={allDone ? 'success' : 'accent'}
            label="Onboarding progress"
            aria-valuetext={`${doneCount} of ${total} steps complete`}
          />
          {allDone ? (
            <p className="gs-progress__done-msg">
              <PartyPopper size={15} aria-hidden="true" />
              All set — you&apos;ve completed onboarding. Nice work!
            </p>
          ) : null}
        </section>

        {/* Checklist */}
        <ul className="gs-list">
          {STEPS.map(({ id, title, description, href, icon: Icon }) => {
            const isDone = Boolean(completed[id]);
            return (
              <li
                key={id}
                className={'gs-card' + (isDone ? ' gs-card--done' : '')}
              >
                <Checkbox
                  className="gs-check"
                  size="md"
                  checked={isDone}
                  onChange={() => toggle(id)}
                  aria-label={
                    isDone
                      ? `Mark "${title}" as not done`
                      : `Mark "${title}" as done`
                  }
                />

                <span className="gs-card__icon" aria-hidden="true">
                  <Icon size={18} />
                </span>

                <div className="gs-card__body">
                  <span className="gs-card__title">{title}</span>
                  <span className="gs-card__desc">{description}</span>
                </div>

                <div className="gs-card__action">
                  <Link
                    href={href}
                    className="gs-do"
                    aria-label={`${title} — do it`}
                  >
                    Do it
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>

        {doneCount > 0 ? (
          <div className="gs-footer">
            <Button variant="ghost" iconLeft={RotateCcw} onClick={reset}>
              Reset progress
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
