'use client';

/**
 * SabCRM — Lab settings (`/sabcrm/settings/lab`), Twenty-style.
 *
 * A list of opt-in experimental feature toggles ("Lab"), in the spirit of
 * Twenty's experimental-features panel. Each row pairs a Twenty-style switch
 * with a label, a short description, and a "Beta" chip. Choices persist to
 * `localStorage` via `useLabFlags` — there is no backend, so these are honest
 * device-local UI preferences and gate nothing server-side.
 *
 * States: a skeleton until the flags hydrate from storage (avoids an SSR flash
 * of stale toggles), then the live list with a summary + "Reset all" action.
 */

import * as React from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useToast } from '@/hooks/use-toast';
import { LAB_FLAGS, useLabFlags, type LabFlagId } from './use-lab-flags';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import '../profile/profile.css';
import './lab.css';

// ---------------------------------------------------------------------------
// Twenty switch — native <button role="switch"> for accessibility.
// ---------------------------------------------------------------------------

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}

function Switch({ checked, onChange, label, disabled }: SwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="st-switch"
      disabled={disabled}
      onClick={onChange}
    >
      <span className="st-switch__knob" aria-hidden="true" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors the flag-row rhythm.
// ---------------------------------------------------------------------------

function ListSkeleton(): React.JSX.Element {
  return (
    <div className="st-lab-list" aria-hidden="true">
      {LAB_FLAGS.map((flag) => (
        <div key={flag.id} className="st-lab-row">
          <div className="st-lab-row__text">
            <div
              className="st-skeleton"
              style={{ width: 180, height: 14, marginBottom: 8 }}
            />
            <div className="st-skeleton" style={{ width: 320, height: 12, maxWidth: '100%' }} />
          </div>
          <div className="st-skeleton" style={{ width: 34, height: 18, borderRadius: 999 }} />
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
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Lab" icon={FlaskConical} />
        <p className="st-settings__intro">
          Try out experimental SabCRM features before they ship. These are early
          and may change or be removed.
        </p>

        <div className="st-lab-note">
          <FlaskConical className="st-lab-note__icon" size={15} aria-hidden="true" />
          <span>
            Every toggle here is a local UI preference, saved in this browser
            only. Nothing is enabled for your teammates and no server setting
            changes — clearing your browser data resets them.
          </span>
        </div>

        {!hydrated ? (
          <ListSkeleton />
        ) : (
          <>
            <div className="st-lab-list">
              {LAB_FLAGS.map((flag) => {
                const checked = flags[flag.id];
                return (
                  <div key={flag.id} className="st-lab-row">
                    <div className="st-lab-row__text">
                      <div className="st-lab-row__head">
                        <span className="st-lab-row__label">{flag.label}</span>
                        <span className="st-chip st-chip--beta">Beta</span>
                      </div>
                      <p className="st-lab-row__desc">{flag.description}</p>
                    </div>
                    <Switch
                      checked={checked}
                      onChange={() => handleToggle(flag.id, flag.label)}
                      label={`Toggle ${flag.label}`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="st-lab-foot">
              <span className="st-lab-foot__summary">
                {enabledCount === 0
                  ? 'No experimental features enabled.'
                  : `${enabledCount} experimental feature${
                      enabledCount !== 1 ? 's' : ''
                    } enabled.`}
              </span>
              <TwentyButton
                variant="secondary"
                icon={RotateCcw}
                onClick={handleReset}
                disabled={enabledCount === 0}
              >
                Reset all
              </TwentyButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
