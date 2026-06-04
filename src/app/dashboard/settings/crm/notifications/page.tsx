'use client';

/**
 * SabCRM — Notifications settings (`/dashboard/settings/crm/notifications`), Twenty-style.
 *
 * Lets the user choose which events notify them and through which channel:
 *
 *   - In-app — the live in-product feed / notification bell that the SabCRM
 *     shell already renders. This channel is real and takes effect immediately.
 *   - Email  — UI-only for now. There is no email delivery engine wired up yet,
 *     so the email switches record intent but do nothing until that engine
 *     ships. This is stated honestly in the per-table callout.
 *
 * A master "Mute all notifications" toggle silences every event regardless of
 * its per-event / per-channel switches. While muted, the per-event toggles keep
 * their stored values (just visually dimmed + disabled) so un-muting restores
 * the previous configuration exactly.
 *
 * Preferences persist to BOTH the gated CRM settings document on the backend
 * (via `useSettingsSync('notifications', …)` → the `getCrmSettingsTw` /
 * `updateCrmSettingsTw` server actions) AND the local `useNotifPrefs` cache, so
 * a user's notification setup follows them across devices while the page never
 * blocks. When the Rust settings engine is down the page degrades to the
 * device-local cache and shows an "offline" note. The page is fully client-side
 * and fails closed: a skeleton renders until the local hook hydrates so there is
 * no SSR / stored-value flash.
 */

import * as React from 'react';
import {
  Bell,
  BellOff,
  Monitor,
  Mail,
  Info,
  RotateCcw,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useToast } from '@/hooks/use-toast';
import {
  useNotifPrefs,
  NOTIF_EVENTS,
  type NotifChannel,
  type NotifEventKey,
  type NotifPrefs,
} from './use-notif-prefs';
import { useSettingsSync } from '../use-settings-sync';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './notifications.css';

/**
 * Narrow the raw stored value into a usable notification slice. We only require
 * the value to be an object — `useNotifPrefs.normalize` (re-run via `replace`)
 * does the deep coercion, so partial / older payloads are safe.
 */
function coerceNotif(raw: unknown): Partial<NotifPrefs> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Partial<NotifPrefs>;
}

// ---------------------------------------------------------------------------
// Switch — native <button role="switch"> for accessibility, namespaced styling
// so it never clashes with the per-page `.st-switch` variants elsewhere.
// ---------------------------------------------------------------------------

interface SwitchProps {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (next: boolean) => void;
}

function Switch({
  checked,
  disabled = false,
  ariaLabel,
  onChange,
}: SwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`stn-switch${checked ? ' stn-switch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="stn-switch__thumb" aria-hidden="true" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton (until the localStorage hook hydrates)
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 5 }: { rows?: number }): React.JSX.Element {
  return (
    <div className="stn-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="stn-skeleton__row" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmNotificationsSettingsPage(): React.JSX.Element {
  const { prefs, setMuteAll, setChannel, replace, reset, hydrated } =
    useNotifPrefs();
  const { toast } = useToast();
  const sync = useSettingsSync<Partial<NotifPrefs>>('notifications', coerceNotif);

  // Adopt the server slice (source of truth) once it resolves — `replace`
  // normalizes it and mirrors it into the local cache.
  React.useEffect(() => {
    if (sync.phase !== 'ready' || !sync.remote) return;
    replace(sync.remote);
  }, [sync.phase, sync.remote, replace]);

  // Persist a fully-resolved prefs snapshot to the server (fire-and-forget; the
  // local cache already updated synchronously, so the UI is never blocked).
  const persist = React.useCallback(
    (next: NotifPrefs) => {
      void sync.save(next);
    },
    [sync],
  );

  const handleMute = React.useCallback(
    (next: boolean) => {
      setMuteAll(next);
      persist({ ...prefs, muteAll: next });
      toast({
        title: next ? 'Notifications muted' : 'Notifications unmuted',
        description: next
          ? 'All SabCRM notifications are silenced until you turn this off.'
          : 'Your per-event preferences are active again.',
      });
    },
    [setMuteAll, persist, prefs, toast],
  );

  const handleChannel = React.useCallback(
    (key: NotifEventKey, channel: NotifChannel, next: boolean) => {
      setChannel(key, channel, next);
      const current = prefs.events[key];
      if (current) {
        persist({
          ...prefs,
          events: {
            ...prefs.events,
            [key]: { ...current, [channel]: next },
          },
        });
      }
    },
    [setChannel, persist, prefs],
  );

  const handleReset = React.useCallback(() => {
    reset();
    // `reset()` restored the local defaults; the server adopt will reconcile on
    // next load, but proactively clear the server slice too so the reset sticks
    // across devices. An empty object is normalized back to defaults on read.
    void sync.save({});
    toast({
      title: 'Notifications reset',
      description: 'Notification preferences restored to their defaults.',
    });
  }, [reset, sync, toast]);

  const muted = prefs.muteAll;

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Notifications" icon={Bell} />
        <p className="st-settings__intro">
          Choose which events notify you and how. Saved to your workspace so your
          preferences follow you across devices.
          {sync.phase === 'offline' ? (
            <span className="stn-offline" role="status">
              The settings service is offline — changes are kept on this device
              for now.
            </span>
          ) : null}
        </p>

        {/* Master mute */}
        <div className={`stn-master${muted ? ' is-muted' : ''}`}>
          <span className="stn-master__icon" aria-hidden="true">
            {muted ? <BellOff size={18} /> : <Bell size={18} />}
          </span>
          <div className="stn-master__text">
            <p className="stn-master__title">Mute all notifications</p>
            <p className="stn-master__hint">
              {muted
                ? 'Every event below is silenced. Your individual choices are kept and will return when you unmute.'
                : 'Silence every event at once without losing your individual choices below.'}
            </p>
          </div>
          <div className="stn-master__control">
            {hydrated ? (
              <Switch
                checked={muted}
                ariaLabel="Mute all notifications"
                onChange={handleMute}
              />
            ) : (
              <span className="stn-switch" aria-hidden="true">
                <span className="stn-switch__thumb" />
              </span>
            )}
          </div>
        </div>

        {/* Events */}
        <section className={`stn-group${muted ? ' is-disabled' : ''}`}>
          <div className="stn-group__head">
            <h2 className="stn-group__title">Events</h2>
            <p className="stn-group__hint">
              Pick a channel for each event. In-app notifications appear in the
              SabCRM notification bell.
            </p>
          </div>

          {!hydrated ? (
            <TableSkeleton rows={NOTIF_EVENTS.length} />
          ) : (
            <div className="stn-table">
              <div className="stn-thead">
                <span className="stn-thead__label">Notify me when…</span>
                <span className="stn-thead__channel">
                  <Monitor size={13} aria-hidden="true" />
                  <span className="stn-thead__channel-text">In-app</span>
                </span>
                <span className="stn-thead__channel">
                  <Mail size={13} aria-hidden="true" />
                  <span className="stn-thead__channel-text">Email</span>
                </span>
              </div>

              {NOTIF_EVENTS.map((ev) => {
                const state = prefs.events[ev.key];
                return (
                  <div key={ev.key} className="stn-row">
                    <div className="stn-row__text">
                      <span className="stn-row__label">{ev.label}</span>
                      <span className="stn-row__desc">{ev.description}</span>
                    </div>
                    <div className="stn-row__cell">
                      <Switch
                        checked={state.inApp}
                        disabled={muted}
                        ariaLabel={`${ev.label} — in-app`}
                        onChange={(next) =>
                          handleChannel(ev.key, 'inApp', next)
                        }
                      />
                    </div>
                    <div className="stn-row__cell">
                      <Switch
                        checked={state.email}
                        disabled={muted}
                        ariaLabel={`${ev.label} — email`}
                        onChange={(next) =>
                          handleChannel(ev.key, 'email', next)
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="stn-callout">
            <Info className="stn-callout__icon" size={14} aria-hidden="true" />
            <span>
              <strong>Email notifications require the delivery engine.</strong>{' '}
              The email switches save your preference now, but no email is sent
              until SabCRM&apos;s notification engine is connected. In-app
              notifications work today.
            </span>
          </div>
        </section>

        {hydrated ? (
          <div className="stn-footer">
            <p className="stn-footer__note">
              {sync.phase === 'offline'
                ? 'Saved automatically on this device.'
                : 'Saved automatically to your workspace.'}
            </p>
            <TwentyButton
              variant="secondary"
              icon={RotateCcw}
              onClick={handleReset}
            >
              Reset to defaults
            </TwentyButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
