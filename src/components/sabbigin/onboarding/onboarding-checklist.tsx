'use client';

/**
 * SabBigin — onboarding checklist (client).
 *
 * A dismissible 4-step "getting started" card shown on the SabBigin home page.
 * The completion booleans are computed on the server (so the check state is
 * authoritative and survives reloads) and passed in as props; this component
 * only owns the local hidden/dismissing UI state and the deep links.
 *
 * Dismissal persists via `updateSabbiginOnboarding({ dismissed: true })`. The
 * card hides itself when every step is done OR when the user dismisses it.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Contact as ContactIcon,
  Handshake,
  Mail,
  Rocket,
  Workflow,
  X,
} from 'lucide-react';

import {
  Card,
  CardBody,
  IconButton,
  Progress,
  toast,
} from '@/components/sabcrm/20ui';
import { updateSabbiginOnboarding } from '@/app/actions/sabbigin.actions';

export interface OnboardingSteps {
  hasPipeline: boolean;
  hasContacts: boolean;
  hasDeal: boolean;
  connectedEmail: boolean;
}

export interface OnboardingChecklistProps {
  steps: OnboardingSteps;
  /** Server-derived dismissed flag from config.onboarding.dismissed. */
  dismissed?: boolean;
}

interface StepDef {
  key: keyof OnboardingSteps;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: typeof Workflow;
}

const STEPS: StepDef[] = [
  {
    key: 'hasPipeline',
    title: 'Create a pipeline',
    description: 'Define the stages your deals move through.',
    href: '/dashboard/sabbigin/pipelines/new',
    cta: 'New pipeline',
    icon: Workflow,
  },
  {
    key: 'hasContacts',
    title: 'Add or import contacts',
    description: 'Bring in the people you do business with.',
    href: '/dashboard/sabbigin/contacts/new',
    cta: 'Add contact',
    icon: ContactIcon,
  },
  {
    key: 'hasDeal',
    title: 'Create your first deal',
    description: 'Start tracking value through the pipeline.',
    href: '/dashboard/sabbigin/deals/new',
    cta: 'New deal',
    icon: Handshake,
  },
  {
    key: 'connectedEmail',
    title: 'Connect email',
    description: 'Send and log email from inside SabBigin.',
    href: '/dashboard/sabbigin/settings/email',
    cta: 'Connect email',
    icon: Mail,
  },
];

export function OnboardingChecklist({
  steps,
  dismissed = false,
}: OnboardingChecklistProps) {
  const [hidden, setHidden] = React.useState(dismissed);
  const [pending, startTransition] = React.useTransition();

  const completedCount = STEPS.filter((s) => steps[s.key]).length;
  const allDone = completedCount === STEPS.length;

  // Hide when dismissed or when every step is complete — nothing to nudge.
  if (hidden || allDone) return null;

  const percent = Math.round((completedCount / STEPS.length) * 100);

  function handleDismiss() {
    setHidden(true);
    startTransition(async () => {
      const res = await updateSabbiginOnboarding({ dismissed: true });
      if (!res.success) {
        // Restore so the user can retry; the write is best-effort.
        setHidden(false);
        toast.error({
          title: 'Could not dismiss',
          description: res.error ?? 'Please try again.',
        });
      }
    });
  }

  return (
    <Card padding="none">
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent)]/12 text-[var(--st-accent)]"
              aria-hidden="true"
            >
              <Rocket className="h-4.5 w-4.5" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--st-text)]">
                Get set up with SabBigin
              </h2>
              <p className="text-xs text-[var(--st-text-secondary)]">
                {completedCount} of {STEPS.length} done — finish these to get the
                most out of your CRM.
              </p>
            </div>
          </div>
          <IconButton
            label="Dismiss onboarding checklist"
            icon={X}
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            disabled={pending}
          />
        </div>

        <div className="mt-3">
          <Progress
            value={percent}
            tone="accent"
            size="sm"
            aria-label={`Onboarding ${percent}% complete`}
          />
        </div>

        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STEPS.map((step) => {
            const done = steps[step.key];
            const Icon = step.icon;
            return (
              <li
                key={step.key}
                className="flex items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                      done
                        ? 'bg-[var(--st-success)]/15 text-[var(--st-success)]'
                        : 'bg-[var(--st-bg-muted)] text-[var(--st-text-tertiary)]',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={[
                        'truncate text-sm font-medium',
                        done
                          ? 'text-[var(--st-text-secondary)] line-through'
                          : 'text-[var(--st-text)]',
                      ].join(' ')}
                    >
                      {step.title}
                    </p>
                    <p className="truncate text-xs text-[var(--st-text-secondary)]">
                      {step.description}
                    </p>
                  </div>
                </div>
                {!done ? (
                  <Link
                    href={step.href}
                    className="u-btn u-btn--outline u-btn--sm shrink-0"
                  >
                    <span className="u-btn__label">{step.cta}</span>
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs font-medium text-[var(--st-success)]">
                    Done
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
