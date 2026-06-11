'use client';

/**
 * AppPresetSettings
 *
 * Full settings panel for `forge_app_preset` blocks — the generic dispatcher
 * that executes app-preset JSON definitions (see
 * `src/lib/sabflow/forge/blocks/generic/app_preset.ts`).
 *
 * Options shape written here:
 *   { presetId, actionId, inputs: Record<fieldId, unknown>,
 *     credentialId?, __label? }
 *
 * - No `presetId` yet → searchable picker over the preset summaries.
 * - With `presetId`     → locked brand header, an action picker over the
 *   preset's endpoints (flat Select for ≤12 endpoints, searchable grouped
 *   list above that — grouped by the optional `endpoint.group` resource
 *   name), the selected endpoint's fields rendered via ForgeFieldRenderer
 *   (AppPresetField maps 1:1 onto ForgeField), and a CredentialSelect bound
 *   to `preset.auth.credentialType`.
 *
 * The Test runner (TestNodePanel) is rendered by BlockSettingsPanel directly
 * below this body for every block, so it is intentionally not duplicated here.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, Package, RefreshCw, Search, Zap } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Spinner,
} from '@/components/sabcrm/20ui';
import { ForgeFieldRenderer } from './ForgeFieldRenderer';
import { CredentialSelect } from '../shared/CredentialSelect';
import {
  fetchPreset,
  fetchPresetSummaries,
} from '@/lib/sabflow/app-presets/client';
import type {
  AppPreset,
  AppPresetEndpoint,
  AppPresetField,
  AppPresetSummary,
} from '@/lib/sabflow/app-presets/types';
import type { ForgeField, ForgeFieldValue } from '@/lib/sabflow/forge/types';
import type { CredentialType } from '@/lib/sabflow/credentials/types';

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  /** Canvas node id — forwarded to the field renderer for graph traversal. */
  nodeId?: string;
  /** Current block options snapshot. */
  options: Record<string, unknown>;
  /** Called with a partial patch to merge into options. */
  onChange: (patch: Record<string, unknown>) => void;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;

/** Above this many endpoints the flat Action Select becomes a searchable, grouped picker. */
const LARGE_PRESET_THRESHOLD = 12;

/** Auto-imported endpoints whose path could not be verified carry this description prefix. */
const UNVERIFIED_PREFIX = '[unverified path]';

const GROUP_FALLBACK = 'General';

/** Resource group for an endpoint — `group` is optional (n8n resource name) with a 'General' fallback. */
function endpointGroup(e: AppPresetEndpoint): string {
  const g = (e as AppPresetEndpoint & { group?: string }).group;
  return typeof g === 'string' && g.trim() ? g.trim() : GROUP_FALLBACK;
}

function isUnverifiedPath(e: AppPresetEndpoint): boolean {
  return (e.description ?? '').startsWith(UNVERIFIED_PREFIX);
}

/** Endpoint description with the `[unverified path]` marker stripped (the chip conveys it instead). */
function endpointDescription(e: AppPresetEndpoint): string | undefined {
  const d = e.description?.trim();
  if (!d) return undefined;
  const clean = d.startsWith(UNVERIFIED_PREFIX) ? d.slice(UNVERIFIED_PREFIX.length).trim() : d;
  return clean || undefined;
}

function isStale(lastVerified: string | undefined): boolean {
  if (!lastVerified) return false;
  const ts = Date.parse(lastVerified);
  return Number.isFinite(ts) && Date.now() - ts > SIX_MONTHS_MS;
}

function isDraft(p: { status?: string; draft?: boolean } | undefined): boolean {
  return p?.draft === true || p?.status === 'draft';
}

/** AppPresetField is a verified subset of ForgeField — map 1:1. */
function toForgeField(f: AppPresetField): ForgeField {
  return {
    id: f.id,
    label: f.label,
    type: f.type,
    required: f.required,
    defaultValue: f.defaultValue as ForgeFieldValue,
    placeholder: f.placeholder,
    helperText: f.description,
    options: f.options,
  };
}

function asInputs(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function AppPresetSettings({ nodeId, options, onChange }: Props) {
  const presetId = typeof options.presetId === 'string' ? options.presetId : '';

  if (!presetId) {
    return <PresetPicker onChange={onChange} />;
  }
  return (
    <PresetEditor
      key={presetId}
      presetId={presetId}
      nodeId={nodeId}
      options={options}
      onChange={onChange}
    />
  );
}

/* ── Picker (no preset selected yet) ─────────────────────────────────────── */

function PresetPicker({ onChange }: { onChange: Props['onChange'] }) {
  const [summaries, setSummaries] = useState<AppPresetSummary[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchPresetSummaries()
      .then((list) => !cancelled && setSummaries(list))
      .catch(() => !cancelled && setSummaries([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!summaries) return [];
    const lower = query.trim().toLowerCase();
    const list = lower
      ? summaries.filter(
          (s) =>
            s.name.toLowerCase().includes(lower) ||
            s.category.toLowerCase().includes(lower) ||
            s.id.includes(lower),
        )
      : summaries;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [summaries, query]);

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-[var(--st-text-secondary)]">
        Pick the app this block should call. The preset defines its API
        endpoints, inputs and credential type.
      </p>

      <Field label="Search apps">
        <Input
          inputSize="sm"
          value={query}
          placeholder="Search presets..."
          iconLeft={Search}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Field>

      {summaries === null ? (
        <div className="flex items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
          <Spinner size="sm" label="Loading presets" />
          Loading presets...
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[11.5px] text-[var(--st-text-tertiary)]">
          {query ? `No presets match "${query}".` : 'No presets available.'}
        </p>
      ) : (
        <div
          role="listbox"
          aria-label="App presets"
          className="max-h-72 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)] divide-y divide-[var(--st-border)]"
        >
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={false}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--st-bg-secondary)] transition-colors"
              onClick={() =>
                onChange({
                  presetId: s.id,
                  __label: s.name,
                  actionId: undefined,
                  inputs: {},
                })
              }
            >
              <Package
                className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-tertiary)]"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-medium text-[var(--st-text)]">
                    {s.name}
                  </span>
                  {isDraft(s) && (
                    <Badge tone="warning" className="shrink-0 !text-[9px]">
                      draft
                    </Badge>
                  )}
                </span>
                <span className="block text-[10.5px] text-[var(--st-text-tertiary)]">
                  {s.category}
                  {typeof s.endpointCount === 'number'
                    ? ` · ${s.endpointCount} action${s.endpointCount === 1 ? '' : 's'}`
                    : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Editor (preset selected) ────────────────────────────────────────────── */

function PresetEditor({
  presetId,
  nodeId,
  options,
  onChange,
}: {
  presetId: string;
  nodeId?: string;
  options: Record<string, unknown>;
  onChange: Props['onChange'];
}) {
  const [preset, setPreset] = useState<AppPreset | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchPreset(presetId)
      .then((p) => !cancelled && setPreset(p ?? null))
      .catch(() => !cancelled && setPreset(null));
    return () => {
      cancelled = true;
    };
  }, [presetId]);

  const optionActionId = typeof options.actionId === 'string' ? options.actionId : '';
  const selectedEndpoint = useMemo(() => {
    if (!preset) return null;
    return (
      preset.endpoints.find((e) => e.id === optionActionId) ??
      preset.endpoints[0] ??
      null
    );
  }, [preset, optionActionId]);

  // Commit the default action once the preset loads so the engine always has
  // a valid options.actionId (the dispatcher requires it).
  useEffect(() => {
    if (!preset || preset.endpoints.length === 0) return;
    const valid = preset.endpoints.some((e) => e.id === optionActionId);
    if (!valid) onChange({ actionId: preset.endpoints[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, optionActionId]);

  const inputs = asInputs(options.inputs);
  const label =
    typeof options.__label === 'string' && options.__label
      ? options.__label
      : preset?.name ?? presetId;

  const clearPreset = () =>
    onChange({
      presetId: undefined,
      actionId: undefined,
      inputs: {},
      credentialId: undefined,
      __label: undefined,
    });

  /* Loading / missing states */
  if (preset === undefined) {
    return (
      <div className="flex items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
        <Spinner size="sm" label="Loading preset" />
        Loading {label}...
      </div>
    );
  }
  if (preset === null) {
    return (
      <div className="space-y-3">
        <Alert tone="danger" title="Preset not found">
          The app preset &quot;{presetId}&quot; could not be loaded.
        </Alert>
        <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={clearPreset}>
          Choose another app
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Locked brand header ───────────────────────────── */}
      <div className="flex items-center gap-2.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
          <Package className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-semibold text-[var(--st-text)]">
              {preset.name}
            </span>
            <Badge tone="neutral" className="shrink-0 !text-[9px]">
              preset
            </Badge>
            {isDraft(preset) && (
              <Badge tone="warning" className="shrink-0 !text-[9px]">
                draft
              </Badge>
            )}
          </span>
          <span className="block truncate text-[10.5px] text-[var(--st-text-tertiary)]">
            {preset.category}
          </span>
        </span>
        <Button variant="ghost" size="sm" onClick={clearPreset}>
          Change
        </Button>
      </div>

      {preset.description && (
        <p className="text-[12px] leading-relaxed text-[var(--st-text-secondary)]">
          {preset.description}
        </p>
      )}

      {/* Stale-verification hint (> 6 months) */}
      {isStale(preset.lastVerified) && (
        <Alert tone="warning" title="Definition may be outdated">
          This preset was last verified on {preset.lastVerified}. The
          provider&apos;s API may have changed since.
        </Alert>
      )}

      {/* ── Authentication ────────────────────────────────── */}
      {preset.auth.type !== 'none' && preset.auth.credentialType && (
        <PanelSection icon="key" title="Authentication">
          <Field label="Credential">
            <CredentialSelect
              credentialType={preset.auth.credentialType as CredentialType}
              value={
                typeof options.credentialId === 'string'
                  ? options.credentialId
                  : undefined
              }
              onChange={(id) => onChange({ credentialId: id })}
            />
          </Field>
        </PanelSection>
      )}

      {/* ── Action + fields ───────────────────────────────── */}
      <PanelSection icon="zap" title="Configuration">
        {preset.endpoints.length > LARGE_PRESET_THRESHOLD ? (
          <EndpointPicker
            endpoints={preset.endpoints}
            selectedId={selectedEndpoint?.id}
            onSelect={(id) => onChange({ actionId: id })}
          />
        ) : (
          <Field label="Action">
            <Select
              value={selectedEndpoint?.id}
              onValueChange={(id) => onChange({ actionId: id })}
            >
              <SelectTrigger aria-label="Action">
                <SelectValue placeholder="Select an action" />
              </SelectTrigger>
              <SelectContent>
                {preset.endpoints.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Method + path of whatever the run will actually call. */}
        {selectedEndpoint && (
          <p className="flex items-center gap-1.5 font-mono text-[10.5px] text-[var(--st-text-tertiary)]">
            <span className="shrink-0 font-semibold">{selectedEndpoint.method}</span>
            <span className="truncate">{selectedEndpoint.path}</span>
            {isUnverifiedPath(selectedEndpoint) && (
              <Badge tone="warning" className="shrink-0 font-sans !text-[9px]">
                path unverified
              </Badge>
            )}
          </p>
        )}

        {selectedEndpoint && endpointDescription(selectedEndpoint) && (
          <p className="text-[11.5px] leading-relaxed text-[var(--st-text-tertiary)]">
            {endpointDescription(selectedEndpoint)}
          </p>
        )}

        {selectedEndpoint && (
          <div className="space-y-4">
            {selectedEndpoint.fields.map((f) => {
              const forgeField = toForgeField(f);
              const current = inputs[f.id];
              const effective = current === undefined ? f.defaultValue : current;
              return (
                <ForgeFieldRenderer
                  key={`${selectedEndpoint.id}:${f.id}`}
                  field={forgeField}
                  value={effective}
                  onChange={(v) => onChange({ inputs: { ...inputs, [f.id]: v } })}
                  blockId="forge_app_preset"
                  actionId={selectedEndpoint.id}
                  credentialId={
                    typeof options.credentialId === 'string'
                      ? options.credentialId
                      : undefined
                  }
                  options={inputs}
                  nodeId={nodeId}
                />
              );
            })}
          </div>
        )}
      </PanelSection>
    </div>
  );
}

/* ── Endpoint picker (large presets: search + grouped list) ──────────────── */

function EndpointPicker({
  endpoints,
  selectedId,
  onSelect,
}: {
  endpoints: AppPresetEndpoint[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  /** Filtered endpoints bucketed by group, preserving the preset's order. */
  const groups = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const filtered = lower
      ? endpoints.filter(
          (e) =>
            e.label.toLowerCase().includes(lower) ||
            (e.description ?? '').toLowerCase().includes(lower) ||
            e.id.toLowerCase().includes(lower) ||
            e.path.toLowerCase().includes(lower) ||
            endpointGroup(e).toLowerCase().includes(lower),
        )
      : endpoints;
    const map = new Map<string, AppPresetEndpoint[]>();
    for (const e of filtered) {
      const group = endpointGroup(e);
      const bucket = map.get(group);
      if (bucket) bucket.push(e);
      else map.set(group, [e]);
    }
    return [...map.entries()];
  }, [endpoints, query]);

  return (
    <Field label="Action">
      <div className="space-y-2">
        <Input
          inputSize="sm"
          value={query}
          placeholder={`Search ${endpoints.length} actions...`}
          iconLeft={Search}
          aria-label="Search actions"
          onChange={(e) => setQuery(e.target.value)}
        />

        {groups.length === 0 ? (
          <p className="text-[11.5px] text-[var(--st-text-tertiary)]">
            No actions match &quot;{query}&quot;.
          </p>
        ) : (
          <div
            role="listbox"
            aria-label="Actions"
            className="max-h-64 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)]"
          >
            {groups.map(([group, list]) => (
              <div key={group}>
                <div className="sticky top-0 z-[1] border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                  {group}
                </div>
                {list.map((e) => {
                  const selected = e.id === selectedId;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                        selected
                          ? 'bg-[var(--st-bg-muted)]'
                          : 'hover:bg-[var(--st-bg-secondary)]'
                      }`}
                      onClick={() => onSelect(e.id)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[12px] font-medium text-[var(--st-text)]">
                            {e.label}
                          </span>
                          {isUnverifiedPath(e) && (
                            <Badge tone="warning" className="shrink-0 !text-[9px]">
                              path unverified
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-[var(--st-text-tertiary)]">
                          {e.method} {e.path}
                        </span>
                      </span>
                      {selected && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

/* ── Section header (matches ForgeBlockSettings) ─────────────────────────── */

function PanelSection({
  icon,
  title,
  children,
}: {
  icon: 'key' | 'zap';
  title: string;
  children: React.ReactNode;
}) {
  const Icon = icon === 'key' ? KeyRound : Zap;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon
          className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}
