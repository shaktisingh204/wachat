'use client';

/**
 * SabCRM — Profile settings (`/sabcrm/settings/profile`), Twenty-style.
 *
 * Shows the current user's identity (avatar + name + email) and an editable
 * form for the display name. There is no dedicated user-profile mutation wired
 * into SabCRM yet, so edits persist to the local `useCrmPrefs` store (device
 * scoped) and surface a success toast — the page never blocks on a backend.
 *
 * The form seeds from the session user provided by `useProject()`, falling back
 * to any locally-saved override so a refresh keeps the user's last edit.
 */

import * as React from 'react';
import { UserRound } from 'lucide-react';

import { TwentyPageHeader, TwentyAvatar, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { useCrmPrefs } from '../use-crm-prefs';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './profile.css';

export default function SabcrmProfileSettingsPage(): React.JSX.Element {
  const { sessionUser } = useProject();
  const { prefs, setPrefs, hydrated } = useCrmPrefs();
  const { toast } = useToast();

  const sessionName = sessionUser?.name?.trim() ?? '';
  const sessionEmail = sessionUser?.email?.trim() ?? '';

  // Local form state, seeded from session and overridden by saved prefs.
  const [name, setName] = React.useState('');
  const [dirty, setDirty] = React.useState(false);

  // Re-seed once the prefs hook hydrates (or the session user resolves), but
  // never clobber an in-progress edit.
  React.useEffect(() => {
    if (!hydrated || dirty) return;
    setName(prefs.displayName || sessionName);
  }, [hydrated, dirty, prefs.displayName, sessionName]);

  const effectiveName = (name || sessionName || sessionEmail).trim();
  const email = sessionEmail;

  const handleSave = React.useCallback(() => {
    const trimmed = name.trim();
    setPrefs({ displayName: trimmed, email });
    setDirty(false);
    toast({
      title: 'Profile saved',
      description: 'Your display name has been updated on this device.',
    });
  }, [name, email, setPrefs, toast]);

  const handleReset = React.useCallback(() => {
    setName(prefs.displayName || sessionName);
    setDirty(false);
  }, [prefs.displayName, sessionName]);

  const canSave = dirty && name.trim().length > 0;

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Profile" icon={UserRound} />
        <p className="st-settings__intro">
          Your personal display details within SabCRM. These preferences are
          stored on this device.
        </p>

        <div className="st-profile-identity">
          <TwentyAvatar
            name={effectiveName || 'You'}
            src={sessionUser?.image ?? undefined}
            size="lg"
          />
          <div className="st-profile-identity__text">
            <span className="st-profile-identity__name">
              {effectiveName || 'Your name'}
            </span>
            {email ? (
              <span className="st-profile-identity__email">{email}</span>
            ) : null}
          </div>
        </div>

        <div className="st-section">
          <div className="st-section__head">
            <h2 className="st-section__title">Name</h2>
            <p className="st-section__hint">The name shown across SabCRM.</p>
          </div>

          <form
            className="st-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave) handleSave();
            }}
          >
            <div className="st-field">
              <label className="st-field__label" htmlFor="crm-profile-name">
                Display name
              </label>
              <input
                id="crm-profile-name"
                className="st-input"
                type="text"
                value={name}
                placeholder={sessionName || 'Enter your name'}
                autoComplete="name"
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
              />
            </div>

            <div className="st-field">
              <label className="st-field__label" htmlFor="crm-profile-email">
                Email
              </label>
              <input
                id="crm-profile-email"
                className="st-input"
                type="email"
                value={email}
                readOnly
                disabled
              />
              <span className="st-field__help">
                Email is managed by your SabNode account and cannot be changed
                here.
              </span>
            </div>

            <div className="st-form-actions">
              <TwentyButton variant="primary" type="submit" disabled={!canSave}>
                Save
              </TwentyButton>
              <TwentyButton
                variant="ghost"
                type="button"
                onClick={handleReset}
                disabled={!dirty}
              >
                Cancel
              </TwentyButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
