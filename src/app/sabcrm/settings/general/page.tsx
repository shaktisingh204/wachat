'use client';

/**
 * SabCRM — General workspace settings (`/sabcrm/settings/general`), Twenty-style.
 *
 * A small Twenty form for the workspace-level CRM preferences kept as a
 * free-form key/value settings object:
 *   - `workspaceName` — display name for the CRM workspace
 *   - `iconEmoji`     — short emoji/string used as the workspace icon
 *   - `defaultObject` — the object the CRM lands on by default
 *
 * Loaded via `getCrmSettingsTw()` and persisted via `updateCrmSettingsTw(patch)`
 * (free-form record contract — see `@/app/actions/sabcrm-settings.actions`).
 * The Save button is dirty-tracked: it stays disabled until a field changes and
 * re-disables once a save lands. Success / error is shown inline next to it.
 *
 * States: skeleton while loading, error banner if the load fails (engine down),
 * and graceful coercion of unknown/empty values to sensible defaults so the
 * form always renders something editable.
 *
 * Rendered inside the layout's `TwentyAppFrame` (`.sabcrm-twenty` scope); all
 * visuals come from the `.st-*` Twenty design system + this page's `general.css`.
 * No ZoruUI / Tailwind / clay.
 */

import * as React from 'react';
import { Settings, AlertTriangle } from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import {
  getCrmSettingsTw,
  updateCrmSettingsTw,
} from '@/app/actions/sabcrm-settings.actions';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './general.css';

// ---------------------------------------------------------------------------
// Form shape — a typed view over the free-form settings object.
// ---------------------------------------------------------------------------

const DEFAULT_OBJECTS = [
  { value: 'companies', label: 'Companies' },
  { value: 'people', label: 'People' },
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'notes', label: 'Notes' },
  { value: 'tasks', label: 'Tasks' },
] as const;

type DefaultObject = (typeof DEFAULT_OBJECTS)[number]['value'];

const DEFAULT_OBJECT_VALUES = DEFAULT_OBJECTS.map((o) => o.value);

interface GeneralForm {
  workspaceName: string;
  iconEmoji: string;
  defaultObject: DefaultObject;
}

const EMPTY_FORM: GeneralForm = {
  workspaceName: '',
  iconEmoji: '',
  defaultObject: 'companies',
};

/** Coerce an arbitrary settings record into the strongly-typed form shape. */
function toForm(raw: Record<string, unknown> | null | undefined): GeneralForm {
  const src = raw ?? {};
  const name = typeof src.workspaceName === 'string' ? src.workspaceName : '';
  const icon = typeof src.iconEmoji === 'string' ? src.iconEmoji : '';
  const obj =
    typeof src.defaultObject === 'string' &&
    (DEFAULT_OBJECT_VALUES as string[]).includes(src.defaultObject)
      ? (src.defaultObject as DefaultObject)
      : 'companies';
  return { workspaceName: name, iconEmoji: icon, defaultObject: obj };
}

function formsEqual(a: GeneralForm, b: GeneralForm): boolean {
  return (
    a.workspaceName === b.workspaceName &&
    a.iconEmoji === b.iconEmoji &&
    a.defaultObject === b.defaultObject
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors the field stack.
// ---------------------------------------------------------------------------

function GeneralSkeleton(): React.JSX.Element {
  return (
    <div className="st-general-form" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="st-field">
          <div
            className="st-skeleton"
            style={{ width: 120, height: 12 }}
          />
          <div className="st-skeleton" style={{ height: 28 }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmGeneralSettingsPage(): React.JSX.Element {
  const [saved, setSaved] = React.useState<GeneralForm>(EMPTY_FORM);
  const [form, setForm] = React.useState<GeneralForm>(EMPTY_FORM);

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<
    { kind: 'ok' | 'err'; message: string } | null
  >(null);

  // Initial load.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const res = await getCrmSettingsTw();
        if (cancelled) return;
        if (res.ok) {
          const next = toForm(res.data);
          setSaved(next);
          setForm(next);
        } else {
          setLoadError(res.error);
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            'Settings could not be loaded. The service may be unavailable.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = !formsEqual(form, saved);

  function patch<K extends keyof GeneralForm>(key: K, value: GeneralForm[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!dirty || saving) return;

    setSaving(true);
    setStatus(null);

    const next: GeneralForm = {
      workspaceName: form.workspaceName.trim(),
      iconEmoji: form.iconEmoji.trim(),
      defaultObject: form.defaultObject,
    };

    try {
      const res = await updateCrmSettingsTw({
        workspaceName: next.workspaceName,
        iconEmoji: next.iconEmoji,
        defaultObject: next.defaultObject,
      });
      if (res.ok) {
        // Prefer the server's echoed state when present, else our patch.
        const persisted = toForm(
          res.data as Record<string, unknown> | null | undefined,
        );
        const resolved =
          res.data && Object.keys(res.data).length > 0 ? persisted : next;
        setSaved(resolved);
        setForm(resolved);
        setStatus({ kind: 'ok', message: 'Saved.' });
      } else {
        setStatus({ kind: 'err', message: res.error });
      }
    } catch {
      setStatus({
        kind: 'err',
        message: 'Could not save. The service may be unavailable.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="General" icon={Settings} />
        <p className="st-settings__intro">
          Workspace-level preferences for your CRM — its display name, icon, and
          the object you land on by default.
        </p>

        {loading ? (
          <GeneralSkeleton />
        ) : loadError ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{loadError}</span>
          </div>
        ) : (
          <form className="st-general-form" onSubmit={handleSubmit}>
            <div className="st-field">
              <label className="st-field__label" htmlFor="gen-workspace-name">
                Workspace name
              </label>
              <input
                id="gen-workspace-name"
                className="st-input"
                type="text"
                value={form.workspaceName}
                onChange={(e) => patch('workspaceName', e.target.value)}
                placeholder="My CRM workspace"
                maxLength={120}
                autoComplete="off"
              />
              <span className="st-field__help">
                Shown across the CRM as the name of this workspace.
              </span>
            </div>

            <div className="st-field">
              <label className="st-field__label" htmlFor="gen-icon">
                Icon
              </label>
              <div className="st-icon-field">
                <span className="st-icon-preview" aria-hidden="true">
                  {form.iconEmoji.trim() || '🏢'}
                </span>
                <input
                  id="gen-icon"
                  className="st-input"
                  type="text"
                  value={form.iconEmoji}
                  onChange={(e) => patch('iconEmoji', e.target.value)}
                  placeholder="🏢"
                  maxLength={8}
                  autoComplete="off"
                />
              </div>
              <span className="st-field__help">
                An emoji or short string used as the workspace icon.
              </span>
            </div>

            <div className="st-field">
              <label className="st-field__label" htmlFor="gen-default-object">
                Default object
              </label>
              <select
                id="gen-default-object"
                className="st-select"
                value={form.defaultObject}
                onChange={(e) =>
                  patch('defaultObject', e.target.value as DefaultObject)
                }
              >
                {DEFAULT_OBJECTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="st-field__help">
                The object opened by default when entering the CRM.
              </span>
            </div>

            <div className="st-general-actions">
              <TwentyButton
                type="submit"
                variant="primary"
                disabled={!dirty || saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </TwentyButton>
              {status ? (
                <span
                  className={`st-form-status ${
                    status.kind === 'ok'
                      ? 'st-form-status--ok'
                      : 'st-form-status--err'
                  }`}
                  role="status"
                >
                  {status.message}
                </span>
              ) : dirty ? (
                <span className="st-form-status" style={{ color: 'var(--st-text-tertiary)' }}>
                  Unsaved changes
                </span>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
