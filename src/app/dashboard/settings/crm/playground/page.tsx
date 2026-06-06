'use client';

/**
 * SabCRM - API Playground settings (`/dashboard/settings/crm/playground`).
 *
 * An in-app tester for the headless REST record API
 * (`/api/sabcrm/:objectSlug[/:recordId]`). It lets an operator pick a method
 * (list / get one / create / update / delete), an object, an optional record
 * id, and an optional JSON body, then EXECUTES the equivalent call and shows
 * the JSON response in a pretty panel, alongside the matching REST path hint
 * (e.g. `GET /api/sabcrm/people`) for documentation.
 *
 * Execution does NOT touch the public route or expose any API key client-side.
 * Instead it runs through the same admin-gated server actions that the record
 * UI uses ({@link listSabcrmRecordsTw} / {@link getSabcrmRecordTw} /
 * {@link createSabcrmRecordTw} / {@link updateSabcrmRecordTw} /
 * {@link deleteSabcrmRecordTw}). Each re-runs the session, project, RBAC and
 * plan pipeline, so the tester is exactly as privileged as the caller, never
 * more, and the REST path is shown purely as copyable documentation.
 *
 * Project scope comes from `useProject()`. States: object catalogue loading,
 * "no project" notice, error banner, per-send loading + result/error panel.
 *
 * Pure 20ui: PageHeader, Card, Field, Input, Textarea, Select (Radix compound),
 * Button, Alert, EmptyState and Badge from `@/components/sabcrm/20ui`.
 */

import * as React from 'react';
import {
  FlaskConical,
  Play,
  Copy,
  Check,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  Alert,
  EmptyState,
  Badge,
} from '@/components/sabcrm/20ui';
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
  { value: 'list', label: 'GET - list records', verb: 'GET', needsRecordId: false, needsBody: false },
  { value: 'getOne', label: 'GET - one record', verb: 'GET', needsRecordId: true, needsBody: false },
  { value: 'create', label: 'POST - create', verb: 'POST', needsRecordId: false, needsBody: true },
  { value: 'update', label: 'PATCH - update', verb: 'PATCH', needsRecordId: true, needsBody: true },
  { value: 'delete', label: 'DELETE - delete', verb: 'DELETE', needsRecordId: true, needsBody: false },
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
      /* clipboard unavailable, no-op */
    }
  }, [value]);

  return (
    <Button variant="ghost" iconLeft={copied ? Check : Copy} onClick={copy}>
      {copied ? 'Copied' : label}
    </Button>
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
    <div className="ui20 mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>API Playground</PageTitle>
          <PageDescription>
            Test the SabCRM REST record API without leaving the app. Pick a
            method and object, then Send to execute the equivalent call through
            your own session. No API key is exposed here. The endpoint hint shows
            the matching REST path for use with a key.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {loadError ? (
        <Alert tone="danger" className="mt-6">
          {loadError}
        </Alert>
      ) : null}

      {noProject ? (
        <div className="mt-6">
          <EmptyState
            icon={AlertTriangle}
            tone="warning"
            title="No project selected"
            description="Select a project to test its records API."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          {/* Request builder */}
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Build a request</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              {/* Method + object + record id */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Method">
                  <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                    <SelectTrigger aria-label="Method">
                      <SelectValue placeholder="Pick a method" />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Object">
                  <Select
                    value={object}
                    onValueChange={setObject}
                    disabled={objectsLoading || objects.length === 0}
                  >
                    <SelectTrigger aria-label="Object">
                      <SelectValue
                        placeholder={objectsLoading ? 'Loading objects' : 'No objects'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {objects.map((o) => (
                        <SelectItem key={o.slug} value={o.slug}>
                          {o.labelPlural} ({o.slug})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {spec.needsRecordId ? (
                  <Field label="Record id">
                    <Input
                      value={recordId}
                      onChange={(e) => setRecordId(e.target.value)}
                      placeholder="e.g. 9f3c..."
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </Field>
                ) : null}
              </div>

              {/* JSON body editor */}
              {spec.needsBody ? (
                <Field
                  label="Request body (JSON)"
                  help={
                    <>
                      A JSON object of field values. A{' '}
                      <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-1 py-0.5 text-[var(--st-text-secondary)]">
                        {'{ "data": { ... } }'}
                      </code>{' '}
                      envelope is also accepted, mirroring the REST route.
                    </>
                  }
                >
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    spellCheck={false}
                    placeholder={'{\n  "name": "Acme Inc."\n}'}
                    className="font-mono text-[13px]"
                  />
                </Field>
              ) : null}

              {/* Endpoint hint */}
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-[var(--st-text)]">
                  Equivalent REST request
                </span>
                <div className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 font-mono text-[13px] text-[var(--st-text)]">
                  <Badge tone="accent" kind="solid">
                    {spec.verb}
                  </Badge>
                  <span className="truncate">{endpoint}</span>
                </div>
                <span className="text-xs text-[var(--st-text-tertiary)]">
                  With an API key:{' '}
                  <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-1 py-0.5 text-[var(--st-text-secondary)]">
                    {`curl -H "Authorization: Bearer <key>" ${spec.verb !== 'GET' ? `-X ${spec.verb} ` : ''}${endpoint}`}
                  </code>
                </span>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  iconLeft={Play}
                  onClick={send}
                  loading={running}
                  disabled={running || objectsLoading || !object}
                >
                  {running ? 'Sending' : 'Send'}
                </Button>
                <CopyButton value={`${spec.verb} ${endpoint}`} label="Copy path" />
              </div>
            </CardBody>
          </Card>

          {/* Response panel */}
          <Card padding="none">
            <div className="flex items-center justify-between border-b border-[var(--st-border)] px-4 py-3">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--st-text)]">
                <ChevronRight size={14} aria-hidden="true" />
                Response
              </span>
              {result ? (
                <Badge tone={result.ok ? 'success' : 'danger'}>
                  {result.ok ? 'Success' : 'Error'}
                </Badge>
              ) : null}
            </div>
            {running ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--st-text-tertiary)]">
                Running request...
              </p>
            ) : result ? (
              <pre className="max-h-[28rem] overflow-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-[var(--st-text)]">
                {result.body}
              </pre>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-[var(--st-text-tertiary)]">
                Send a request to see the JSON response here.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
