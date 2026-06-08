'use client';

/**
 * SabCRM - Profile settings (`/dashboard/settings/crm/profile`).
 *
 * Shows the current user's identity (avatar + name + email) and an editable
 * form for the display name. Edits persist to BOTH the gated CRM settings
 * document on the backend (via `useSettingsSync('profile', ...)` -> the
 * `getCrmSettingsTw` / `updateCrmSettingsTw` server actions) AND the local
 * `useCrmPrefs` cache, so a saved name follows the user across devices yet the
 * page never blocks: when the Rust settings engine is down it degrades to the
 * device-local cache and reports an "offline" status inline.
 *
 * Source-of-truth order on load: server slice (if present), local cache,
 * session user. The form seeds from whichever resolves first and never clobbers
 * an in-progress edit.
 *
 * UI: pure 20ui design system.
 */

import * as React from 'react';
import { UserRound } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Field,
  Input,
  Button,
  Avatar,
  Alert,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { useCrmPrefs } from '../use-crm-prefs';
import { useSettingsSync, type SyncOutcome } from '../use-settings-sync';

import '@/components/sabcrm/20ui/surface-crm-base.css';

/** The profile slice persisted under the `'profile'` settings key. */
interface ProfileSlice {
  displayName: string;
}

/** Narrow the raw stored value into a usable profile slice (or null). */
function coerceProfile(raw: unknown): ProfileSlice | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.displayName !== 'string') return null;
  return { displayName: o.displayName };
}

export default function SabcrmProfileSettingsPage(): React.JSX.Element {
  const { sessionUser } = useProject();
  const { prefs, setPrefs, hydrated } = useCrmPrefs();
  const { toast } = useToast();
  const sync = useSettingsSync<ProfileSlice>('profile', coerceProfile);

  const sessionName = sessionUser?.name?.trim() ?? '';
  const sessionEmail = sessionUser?.email?.trim() ?? '';

  // Local form state, seeded from session and overridden by saved prefs.
  const [name, setName] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Re-seed once the prefs hook hydrates (or the session user resolves), but
  // never clobber an in-progress edit.
  React.useEffect(() => {
    if (!hydrated || dirty) return;
    setName(prefs.displayName || sessionName);
  }, [hydrated, dirty, prefs.displayName, sessionName]);

  // When the server resolves a stored profile, adopt it as the source of truth
  // (unless the user is mid-edit) and mirror it into the local cache.
  React.useEffect(() => {
    if (sync.phase !== 'ready' || !sync.remote || dirty) return;
    setName(sync.remote.displayName);
    setPrefs({ displayName: sync.remote.displayName });
  }, [sync.phase, sync.remote, dirty, setPrefs]);

  const effectiveName = (name || sessionName || sessionEmail).trim();
  const email = sessionEmail;

  const handleSave = React.useCallback(async () => {
    const trimmed = name.trim();
    setSaving(true);
    // Always update the instant local cache first.
    setPrefs({ displayName: trimmed, email });
    setDirty(false);
    const outcome: SyncOutcome = await sync.save({ displayName: trimmed });
    setSaving(false);
    toast({
      title: outcome === 'saved' ? 'Profile saved' : 'Saved on this device',
      description:
        outcome === 'saved'
          ? 'Your display name has been updated for your workspace.'
          : 'The settings service is unavailable, so your name was saved on this device only.',
      variant: outcome === 'saved' ? 'success' : 'default',
    });
  }, [name, email, setPrefs, sync, toast]);

  const handleReset = React.useCallback(() => {
    setName(prefs.displayName || sessionName);
    setDirty(false);
  }, [prefs.displayName, sessionName]);

  const canSave = dirty && name.trim().length > 0 && !saving;

  return (
    <div className="20ui">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <PageHeader bordered={false}>
          <PageHeaderHeading>
            <PageTitle>Profile</PageTitle>
            <PageDescription>
              Your personal display details within SabCRM. Saved to your
              workspace so they follow you across devices.
            </PageDescription>
          </PageHeaderHeading>
        </PageHeader>

        {sync.phase === 'offline' ? (
          <Alert tone="warning" title="Settings service offline">
            Changes are kept on this device for now.
          </Alert>
        ) : null}

        <div className="flex items-center gap-4">
          <Avatar
            name={effectiveName || 'You'}
            src={sessionUser?.image ?? undefined}
            size="lg"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-semibold text-[var(--st-text)]">
              {effectiveName || 'Your name'}
            </span>
            {email ? (
              <span className="text-sm text-[var(--st-text-secondary)]">
                {email}
              </span>
            ) : null}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Name</CardTitle>
            <CardDescription>The name shown across SabCRM.</CardDescription>
          </CardHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave) handleSave();
            }}
          >
            <CardBody className="flex flex-col gap-4">
              <Field label="Display name">
                <Input
                  type="text"
                  value={name}
                  placeholder={sessionName || 'Enter your name'}
                  autoComplete="name"
                  onChange={(e) => {
                    setName(e.target.value);
                    setDirty(true);
                  }}
                />
              </Field>

              <Field
                label="Email"
                help="Email is managed by your SabNode account and cannot be changed here."
              >
                <Input type="email" value={email} readOnly disabled />
              </Field>
            </CardBody>

            <CardFooter className="flex items-center gap-2">
              <Button variant="primary" type="submit" disabled={!canSave} loading={saving}>
                {saving ? 'Saving' : 'Save'}
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={handleReset}
                disabled={!dirty}
              >
                Cancel
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
