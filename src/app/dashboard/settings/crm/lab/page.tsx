'use client';

/**
 * SabCRM - Lab settings (`/dashboard/settings/crm/lab`), pure 20ui.
 *
 * A list of opt-in experimental feature toggles ("Lab"). Each row pairs a 20ui
 * Switch with a label, a short description, and a "Beta" badge. Choices persist
 * to `localStorage` via `useLabFlags`, there is no backend, so these are honest
 * device-local UI preferences and gate nothing server-side.
 *
 * States: a skeleton until the flags hydrate from storage (avoids an SSR flash
 * of stale toggles), then the live list with a summary + "Reset all" action.
 */

import * as React from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Switch,
  Skeleton,
} from '@/components/sabcrm/20ui';
import { useToast } from '@/hooks/use-toast';
import { LAB_FLAGS, useLabFlags, type LabFlagId } from './use-lab-flags';

// ---------------------------------------------------------------------------
// Loading skeleton - mirrors the flag-row rhythm.
// ---------------------------------------------------------------------------

function ListSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-px" aria-hidden="true">
      {LAB_FLAGS.map((flag) => (
        <div
          key={flag.id}
          className="flex items-center justify-between gap-4 border-b border-[var(--st-border)] py-4 last:border-b-0"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton width={180} height={14} />
            <Skeleton width={320} height={12} className="max-w-full" />
          </div>
          <Skeleton width={34} height={18} radius={999} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmLabSettingsPage(): React.JSX.Element {
  const { flags, toggleFlag, resetAll, enabledCount, hydrated } = useLabFlags();
  const { toast } = useToast();

  const handleToggle = React.useCallback(
    (id: LabFlagId, label: string) => {
      const nextOn = !flags[id];
      toggleFlag(id);
      toast({
        title: nextOn ? `${label} enabled` : `${label} disabled`,
        description: 'Saved on this device.',
      });
    },
    [flags, toggleFlag, toast],
  );

  const handleReset = React.useCallback(() => {
    if (enabledCount === 0) return;
    resetAll();
    toast({
      title: 'Lab reset',
      description: 'All experimental features were turned off.',
    });
  }, [enabledCount, resetAll, toast]);

  return (
    <div className="ui20">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>
              <span className="inline-flex items-center gap-2">
                <FlaskConical
                  size={18}
                  className="text-[var(--st-text-secondary)]"
                  aria-hidden="true"
                />
                Lab
              </span>
            </PageTitle>
            <PageDescription>
              Try out experimental SabCRM features before they ship. These are
              early and may change or be removed.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>

        <Card variant="outlined" padding="md">
          <CardBody className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--st-text-secondary)]">
            <FlaskConical
              size={15}
              className="mt-0.5 shrink-0 text-[var(--st-accent)]"
              aria-hidden="true"
            />
            <span>
              Every toggle here is a local UI preference, saved in this browser
              only. Nothing is enabled for your teammates and no server setting
              changes. Clearing your browser data resets them.
            </span>
          </CardBody>
        </Card>

        {!hydrated ? (
          <ListSkeleton />
        ) : (
          <>
            <div className="flex flex-col">
              {LAB_FLAGS.map((flag) => {
                const checked = flags[flag.id];
                return (
                  <div
                    key={flag.id}
                    className="flex items-center justify-between gap-4 border-b border-[var(--st-border)] py-4 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--st-text)]">
                          {flag.label}
                        </span>
                        <Badge tone="accent" kind="soft">
                          Beta
                        </Badge>
                      </div>
                      <p className="text-[13px] leading-relaxed text-[var(--st-text-secondary)]">
                        {flag.description}
                      </p>
                    </div>
                    <Switch
                      checked={checked}
                      onCheckedChange={() => handleToggle(flag.id, flag.label)}
                      aria-label={`Toggle ${flag.label}`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-[var(--st-text-secondary)]">
                {enabledCount === 0
                  ? 'No experimental features enabled.'
                  : `${enabledCount} experimental feature${
                      enabledCount !== 1 ? 's' : ''
                    } enabled.`}
              </span>
              <Button
                variant="secondary"
                iconLeft={RotateCcw}
                onClick={handleReset}
                disabled={enabledCount === 0}
              >
                Reset all
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
