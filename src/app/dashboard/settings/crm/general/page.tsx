'use client';

/**
 * SabCRM - General workspace settings (`/dashboard/settings/crm/general`).
 *
 * A small form for the workspace-level CRM preferences kept as a free-form
 * key/value settings object:
 *   - `workspaceName` - display name for the CRM workspace
 *   - `iconEmoji`     - short emoji/string used as the workspace icon
 *   - `defaultObject` - the object the CRM lands on by default
 *
 * Loaded via `getCrmSectionTw('general')` and persisted via
 * `updateCrmSectionTw('general', patch)` (free-form record contract - see
 * `@/app/actions/sabcrm-settings.actions`). The Save button is dirty-tracked: it
 * stays disabled until a field changes and re-disables once a save lands.
 * Success / error is surfaced through the 20ui toast layer.
 *
 * States: skeleton while loading, an Alert if the load fails (engine down), and
 * graceful coercion of unknown/empty values to sensible defaults so the form
 * always renders something editable.
 *
 * Pure 20ui: every control comes from `@/components/sabcrm/20ui`. The enclosing
 * settings shell establishes the `ui20 sabcrm-twenty` scope, so all `--st-*` /
 * `--u-*` tokens resolve here.
 */

import * as React from 'react';
import { Settings, Building2 } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Card,
  CardBody,
  Field,
  Input,
  Button,
  Badge,
  Alert,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  getCrmSectionTw,
  updateCrmSectionTw,
} from '@/app/actions/sabcrm-settings.actions';

// ---------------------------------------------------------------------------
// Form shape - a typed view over the free-form settings object.
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
// Loading skeleton - mirrors the field stack.
// ---------------------------------------------------------------------------

function GeneralSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-[var(--st-space-4)]" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-[var(--st-space-2)]">
          <Skeleton width={120} height={12} />
          <Skeleton height={32} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmGeneralSettingsPage(): React.JSX.Element {
  const { toast } = useToast();

  const [saved, setSaved] = React.useState<GeneralForm>(EMPTY_FORM);
  const [form, setForm] = React.useState<GeneralForm>(EMPTY_FORM);

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [saving, setSaving] = React.useState(false);

  // Initial load.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const res = await getCrmSectionTw('general');
        if (cancelled) return;
        if (res.ok) {
          const next = toForm(
            res.data as Record<string, unknown> | null | undefined,
          );
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
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!dirty || saving) return;

    setSaving(true);

    const next: GeneralForm = {
      workspaceName: form.workspaceName.trim(),
      iconEmoji: form.iconEmoji.trim(),
      defaultObject: form.defaultObject,
    };

    try {
      const res = await updateCrmSectionTw('general', {
        workspaceName: next.workspaceName,
        iconEmoji: next.iconEmoji,
        defaultObject: next.defaultObject,
      });
      if (res.ok) {
        // Prefer the server's echoed state when present, else our patch.
        const echoed = res.data as Record<string, unknown> | null | undefined;
        const persisted = toForm(echoed);
        const resolved =
          echoed && Object.keys(echoed).length > 0 ? persisted : next;
        setSaved(resolved);
        setForm(resolved);
        toast.success('Settings saved.');
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error('Could not save. The service may be unavailable.');
    } finally {
      setSaving(false);
    }
  }

  const iconPreview = form.iconEmoji.trim() || '🏢';

  return (
    <div className="flex flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>
            <span className="inline-flex items-center gap-[var(--st-space-2)]">
              <Settings size={18} aria-hidden="true" />
              General
            </span>
          </PageTitle>
          <PageDescription>
            Workspace-level preferences for your CRM. Its display name, icon, and
            the object you land on by default.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {loading ? (
        <Card>
          <CardBody>
            <GeneralSkeleton />
          </CardBody>
        </Card>
      ) : loadError ? (
        <Alert tone="danger" title="Could not load settings">
          {loadError}
        </Alert>
      ) : (
        <Card>
          <CardBody>
            <form
              className="flex max-w-[520px] flex-col gap-[var(--st-space-5)]"
              onSubmit={handleSubmit}
            >
              <Field
                label="Workspace name"
                help="Shown across the CRM as the name of this workspace."
              >
                <Input
                  type="text"
                  value={form.workspaceName}
                  onChange={(e) => patch('workspaceName', e.target.value)}
                  placeholder="My CRM workspace"
                  maxLength={120}
                  autoComplete="off"
                />
              </Field>

              <Field
                label="Icon"
                help="An emoji or short string used as the workspace icon."
              >
                <div className="flex items-center gap-[var(--st-space-3)]">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-lg leading-none"
                    aria-hidden="true"
                  >
                    {iconPreview}
                  </span>
                  <Input
                    type="text"
                    value={form.iconEmoji}
                    onChange={(e) => patch('iconEmoji', e.target.value)}
                    placeholder="🏢"
                    maxLength={8}
                    autoComplete="off"
                  />
                </div>
              </Field>

              <Field
                label="Default object"
                help="The object opened by default when entering the CRM."
              >
                <Select
                  value={form.defaultObject}
                  onValueChange={(value) =>
                    patch('defaultObject', value as DefaultObject)
                  }
                >
                  <SelectTrigger aria-label="Default object">
                    <SelectValue placeholder="Choose an object" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_OBJECTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex items-center gap-[var(--st-space-3)]">
                <Button
                  type="submit"
                  variant="primary"
                  iconLeft={Building2}
                  loading={saving}
                  disabled={!dirty || saving}
                >
                  {saving ? 'Saving' : 'Save'}
                </Button>
                {dirty && !saving ? (
                  <Badge tone="warning" kind="soft" dot>
                    Unsaved changes
                  </Badge>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
