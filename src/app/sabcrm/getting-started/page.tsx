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
  Check,
  ArrowRight,
  Rocket,
  PartyPopper,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import './getting-started.css';

/**
 * SabCRM — Getting Started (`/sabcrm/getting-started`).
 *
 * A Twenty-style onboarding checklist. Each step is a card (icon, title,
 * description, a "Do it" deep-link and a checkbox). Ticking a step persists
 * its completion to `localStorage` so progress survives reloads. A progress
 * bar at the top reflects `n / total` done.
 *
 * Rendered inside the layout's `TwentyAppFrame` (`.sabcrm-twenty` scope), so
 * all visuals come from the `.st-*` Twenty design system + the page-local
 * `.st-gs-*` classes in `getting-started.css`. No ZoruUI / Tailwind.
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
    href: '/sabcrm/opportunities',
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
    <div className="st-gs">
      <div className="st-gs__inner">
        <TwentyPageHeader title="Getting Started" icon={Rocket} />
        <p className="st-gs__lead">
          A few quick steps to set up SabCRM. Tick each one off as you go — your
          progress is saved on this device.
        </p>

        {/* Progress */}
        <section
          className={
            'st-gs-progress' + (allDone ? ' st-gs-progress--done' : '')
          }
          aria-label="Onboarding progress"
        >
          <div className="st-gs-progress__head">
            <span className="st-gs-progress__title">Your progress</span>
            <span className="st-gs-progress__count">
              <strong>{doneCount}</strong> of {total} complete
            </span>
          </div>
          <div
            className="st-gs-progress__track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={doneCount}
            aria-valuetext={`${doneCount} of ${total} steps complete`}
          >
            <div
              className="st-gs-progress__fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          {allDone ? (
            <p className="st-gs-progress__done-msg">
              <PartyPopper size={15} aria-hidden="true" />
              All set — you&apos;ve completed onboarding. Nice work!
            </p>
          ) : null}
        </section>

        {/* Checklist */}
        <ul className="st-gs-list">
          {STEPS.map(({ id, title, description, href, icon: Icon }) => {
            const isDone = Boolean(completed[id]);
            return (
              <li
                key={id}
                className={'st-gs-card' + (isDone ? ' st-gs-card--done' : '')}
              >
                <button
                  type="button"
                  className={'st-gs-check' + (isDone ? ' st-gs-check--on' : '')}
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={
                    isDone
                      ? `Mark "${title}" as not done`
                      : `Mark "${title}" as done`
                  }
                  onClick={() => toggle(id)}
                >
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </button>

                <span className="st-gs-card__icon" aria-hidden="true">
                  <Icon size={18} />
                </span>

                <div className="st-gs-card__body">
                  <span className="st-gs-card__title">{title}</span>
                  <span className="st-gs-card__desc">{description}</span>
                </div>

                <div className="st-gs-card__action">
                  <Link
                    href={href}
                    className="st-gs-do"
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
          <div className="st-gs-footer">
            <TwentyButton variant="ghost" icon={RotateCcw} onClick={reset}>
              Reset progress
            </TwentyButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
