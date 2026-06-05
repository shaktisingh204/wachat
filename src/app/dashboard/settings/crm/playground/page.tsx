'use client';

/**
 * SabCRM — API Playground settings (`/dashboard/settings/crm/playground`), Twenty-style.
 *
 * An in-app tester for the headless REST record API
 * (`/api/sabcrm/:objectSlug[/:recordId]`). It lets an operator pick a method
 * (list / get one / create / update / delete), an object, an optional record
 * id, and an optional JSON body, then EXECUTES the equivalent call and shows
 * the JSON response in a pretty panel — alongside the matching REST path hint
 * (e.g. `GET /api/sabcrm/people`) for documentation.
 *
 * Execution does NOT touch the public route or expose any API key client-side.
 * Instead it runs through the same admin-gated server actions that the Twenty
 * UI uses ({@link listSabcrmRecordsTw} / {@link getSabcrmRecordTw} /
 * {@link createSabcrmRecordTw} / {@link updateSabcrmRecordTw} /
 * {@link deleteSabcrmRecordTw}). Each re-runs the session → project → RBAC →
 * plan pipeline, so the tester is exactly as privileged as the caller — never
 * more — and the REST path is shown purely as copyable documentation.
 *
 * Project scope comes from `useProject()`. States: object catalogue skeleton,
 * "no project" notice, error banner, per-send loading + result/error panel.
 */

import * as React from 'react';
import {
  FlaskConical,
  Play,
  Copy,
  Check,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import {
  listSabcrmRecordsTw,
  getSabcrmRecordTw,
  createSabcrmRecordTw,
  updateSabcrmRecordTw,
  deleteSabcrmRecordTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../settings-twenty.css';
import './playground.css';

// ---------------------------------------------------------------------------
// Method catalogue
// ---------------------------------------------------------------------------

type Method = 'list' | 'getOne' | 'create' | 'update' | 'delete';

interface MethodSpec {
  /** Stable select value. */
  value: Method;
  /** Human label shown in the select. */
  label: string;
  /** HTTP verb the equivalent REST call uses. */
  verb: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Whether this method targets a single record (needs a record id). */
  needsRecordId: boolean;
  /** Whether this method accepts a JSON request body. */
  needsBody: boolean;
}

const METHODS: MethodSpec[] = [
  { value: 'list', label: 'GET — list records', verb: 'GET', needsRecordId: false, needsBody: false },
  { value: 'getOne', label: 'GET — one record', verb: 'GET', needsRecordId: true, needsBody: false },
  { value: 'create', label: 'POST — create', verb: 'POST', needsRecordId: false, needsBody: true },
  { value: 'update', label: 'PATCH — update', verb: 'PATCH', needsRecordId: true, needsBody: true },
  { value: 'delete', label: 'DELETE — delete', verb: 'DELETE', needsRecordId: true, needsBody: false },
];

function methodSpec(method: Method): MethodSpec {
  return METHODS.find((m) => m.value === method) ?? METHODS[0]!;
}

/** The REST path a method + object (+ id) maps to, for the documentation hint. */
function restPath(spec: MethodSpec, object: string, recordId: string): string {
  const slug = object || '{object}';
  if (spec.needsRecordId) {
    const id = recordId.trim() || '{id}';
    return `/api/sabcrm/${slug}/${id}`;
  }
  return `/api/sabcrm/${slug}`;
}

// ---------------------------------------------------------------------------
// Result model
// ---------------------------------------------------------------------------

interface RunResult {
  ok: boolean;
  /** Pretty-printed JSON payload (the action's data, or the error envelope). */
  body: string;
}

/** Pretty-print any JSON-serialisable value, never throwing. */
function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// Copyable inline value (endpoint / response)
// ---------------------------------------------------------------------------

function CopyButton({ value, label }: { value: string; label: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }, [value]);

  return (
    <TwentyButton variant="ghost" icon={copied ? Check : Copy} onClick={copy}>
      {copied ? 'Copied' : label}
    </TwentyButton>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmApiPlaygroundPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  // Object catalogue (drives the object select).
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [objectsLoading, setObjectsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Request builder state.
  const [method, setMethod] = React.useState<Method>('list');
  const [object, setObject] = React.useState('');
  const [recordId, setRecordId] = React.useState('');
  const [body, setBody] = React.useState('{\n  "name": "Example"\n}');

  // Execution state.
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<RunResult | null>(null);

  const spec = methodSpec(method);

  // Load the object catalogue once a project is resolved.
  const loadObjects = React.useCallback(async (projectId: string) => {
    setObjectsLoading(true);
    setLoadError(null);
    try {
      const res = await listObjectsTw(projectId);
      if (res.ok) {
        setObjects(res.data);
        // Default the object select to the first available object.
        setObject((cur) => cur || res.data[0]?.slug || '');
      } else {
        setLoadError(res.error);
      }
    } catch {
      setLoadError('Objects could not be loaded. The service may be unavailable.');
    } finally {
      setObjectsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setObjectsLoading(false);
      return;
    }
    void loadObjects(activeProjectId);
  }, [activeProjectId, isLoadingProject, loadObjects]);

  // Execute the selected method through the matching gated action.
  const send = React.useCallback(async () => {
    if (running || !activeProjectId || !object) return;

    // Pre-flight validation mirrored from the actions' own guards so the user
    // gets an inline message instead of a generic failure.
    if (spec.needsRecordId && !recordId.trim()) {
      setResult({ ok: false, body: pretty({ error: 'A record id is required for this method.' }) });
      return;
    }

    let parsedBody: Record<string, unknown> = {};
    if (spec.needsBody) {
      try {
        const raw = body.trim() ? JSON.parse(body) : {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          throw new Error('Body must be a JSON object of field values.');
        }
        // Accept both a bare field map and the `{ data: {...} }` envelope the
        // REST route tolerates, to keep parity with the public API.
        parsedBody =
          'data' in raw && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
            ? (raw.data as Record<string, unknown>)
            : (raw as Record<string, unknown>);
      } catch (e) {
        setResult({
          ok: false,
          body: pretty({
            error: e instanceof Error ? `Invalid JSON body: ${e.message}` : 'Invalid JSON body.',
          }),
        });
        return;
      }
    }

    setRunning(true);
    setResult(null);
    try {
      const id = recordId.trim();
      switch (method) {
        case 'list': {
          const res = await listSabcrmRecordsTw(object, {}, activeProjectId);
          setResult(res.ok ? { ok: true, body: pretty(res.data) } : { ok: false, body: pretty({ error: res.error }) });
          break;
        }
        case 'getOne': {
          const res = await getSabcrmRecordTw(object, id, activeProjectId);
          setResult(res.ok ? { ok: true, body: pretty(res.data) } : { ok: false, body: pretty({ error: res.error }) });
          break;
        }
        case 'create': {
          const res = await createSabcrmRecordTw(object, parsedBody, activeProjectId);
          setResult(res.ok ? { ok: true, body: pretty(res.data) } : { ok: false, body: pretty({ error: res.error }) });
          break;
        }
        case 'update': {
          const res = await updateSabcrmRecordTw(object, id, parsedBody, activeProjectId);
          setResult(res.ok ? { ok: true, body: pretty(res.data) } : { ok: false, body: pretty({ error: res.error }) });
          break;
        }
        case 'delete': {
          const res = await deleteSabcrmRecordTw(object, id, activeProjectId);
          setResult(res.ok ? { ok: true, body: pretty(res.data) } : { ok: false, body: pretty({ error: res.error }) });
          break;
        }
        default:
          setResult({ ok: false, body: pretty({ error: 'Unsupported method.' }) });
      }
    } catch {
      setResult({
        ok: false,
        body: pretty({ error: 'The request failed. The service may be unavailable.' }),
      });
    } finally {
      setRunning(false);
    }
  }, [running, activeProjectId, object, recordId, body, method, spec]);

  const endpoint = restPath(spec, object, recordId);
  const noProject = !isLoadingProject && !activeProjectId;

  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="API Playground" icon={FlaskConical} />
        <p className="st-settings__intro">
          Test the SabCRM REST record API without leaving the app. Pick a method
          and object, then <strong>Send</strong> to execute the equivalent call
          through your own session — no API key is exposed here. The endpoint
          hint shows the matching REST path for use with a key.
        </p>

        {loadError ? (
          <div className="st-banner">
            <AlertTriangle className="st-banner__icon" size={16} />
            <span>{loadError}</span>
          </div>
        ) : null}

        {noProject ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <AlertTriangle size={20} />
            </span>
            <h2 className="st-empty__title">No project selected</h2>
            <p className="st-empty__desc">
              Select a project to test its records API.
            </p>
          </div>
        ) : (
          <>
            <div className="st-pg-builder">
              {/* Method + object + record id */}
              <div className="st-pg-row">
                <div className="st-pg-field st-pg-field--method">
                  <label className="st-pg-field__label" htmlFor="pg-method">
                    Method
                  </label>
                  <select
                    id="pg-method"
                    className="st-select"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as Method)}
                  >
                    {METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="st-pg-field">
                  <label className="st-pg-field__label" htmlFor="pg-object">
                    Object
                  </label>
                  <select
                    id="pg-object"
                    className="st-select"
                    value={object}
                    onChange={(e) => setObject(e.target.value)}
                    disabled={objectsLoading || objects.length === 0}
                  >
                    {objects.length === 0 ? (
                      <option value="">
                        {objectsLoading ? 'Loading…' : 'No objects'}
                      </option>
                    ) : (
                      objects.map((o) => (
                        <option key={o.slug} value={o.slug}>
                          {o.labelPlural} ({o.slug})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {spec.needsRecordId ? (
                  <div className="st-pg-field">
                    <label className="st-pg-field__label" htmlFor="pg-record-id">
                      Record id
                    </label>
                    <input
                      id="pg-record-id"
                      className="st-input"
                      value={recordId}
                      onChange={(e) => setRecordId(e.target.value)}
                      placeholder="e.g. 9f3c…"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                ) : null}
              </div>

              {/* JSON body editor */}
              {spec.needsBody ? (
                <div className="st-pg-field">
                  <label className="st-pg-field__label" htmlFor="pg-body">
                    Request body (JSON)
                  </label>
                  <textarea
                    id="pg-body"
                    className="st-textarea st-pg-code"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    spellCheck={false}
                    placeholder={'{\n  "name": "Acme Inc."\n}'}
                  />
                  <span className="st-pg-field__hint">
                    A JSON object of field values. A <code>{'{ "data": { … } }'}</code>{' '}
                    envelope is also accepted, mirroring the REST route.
                  </span>
                </div>
              ) : null}

              {/* Endpoint hint */}
              <div className="st-pg-field">
                <span className="st-pg-field__label">Equivalent REST request</span>
                <div className="st-pg-endpoint">
                  <span className="st-pg-method-tag">{spec.verb}</span>
                  <span>{endpoint}</span>
                </div>
                <span className="st-pg-field__hint">
                  With an API key:{' '}
                  <code>{`curl -H "Authorization: Bearer <key>" ${spec.verb !== 'GET' ? `-X ${spec.verb} ` : ''}${endpoint}`}</code>
                </span>
              </div>

              {/* Actions */}
              <div className="st-pg-actions">
                <TwentyButton
                  variant="primary"
                  icon={Play}
                  onClick={send}
                  disabled={running || objectsLoading || !object}
                >
                  {running ? 'Sending…' : 'Send'}
                </TwentyButton>
                <CopyButton value={`${spec.verb} ${endpoint}`} label="Copy path" />
              </div>
            </div>

            {/* Response panel */}
            <div className="st-pg-result">
              <div className="st-pg-result__head">
                <span className="st-pg-result__title">
                  <ChevronRight size={14} aria-hidden="true" />
                  Response
                </span>
                {result ? (
                  <span
                    className={`st-pg-status ${result.ok ? 'st-pg-status--ok' : 'st-pg-status--fail'}`}
                  >
                    {result.ok ? 'Success' : 'Error'}
                  </span>
                ) : null}
              </div>
              {running ? (
                <div className="st-pg-placeholder">Running request…</div>
              ) : result ? (
                <pre className="st-pg-pre">{result.body}</pre>
              ) : (
                <div className="st-pg-placeholder">
                  Send a request to see the JSON response here.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
