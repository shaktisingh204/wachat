'use client';

import { useCallback, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import {
  Webhook,
  Plus,
  Trash2,
  Play,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import type { Block, Variable, WebhookOptions, KVPair, WebhookBody } from '@/lib/sabflow/types';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Field,
  Input,
  Textarea,
  Button,
  IconButton,
  Switch,
  Separator,
  SegmentedControl,
  Badge,
  Card,
  EmptyState,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { VariableSelect } from './shared/VariableSelect';

/* ══════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════ */

type HttpMethod = NonNullable<WebhookOptions['method']>;
type BodyType = WebhookBody['type'];
type ActiveTab = 'headers' | 'params' | 'body' | 'response';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BODY_METHODS: HttpMethod[] = ['POST', 'PUT', 'PATCH'];
const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'raw', label: 'Raw' },
];

/* ══════════════════════════════════════════════════════════
   Props
   ══════════════════════════════════════════════════════════ */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ══════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════ */

/** Reusable key-value list editor */
function KVList({
  rows,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value or {{variable}}',
  emptyLabel = 'No rows yet.',
  addLabel = 'Add row',
  onChange,
}: {
  rows: KVPair[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyLabel?: string;
  addLabel?: string;
  onChange: (rows: KVPair[]) => void;
}) {
  const add = () => onChange([...rows, { id: createId(), key: '', value: '' }]);
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const patch = (id: string, field: 'key' | 'value', val: string) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));

  return (
    <div className="space-y-2">
      {rows.length === 0 && <EmptyState size="sm" title={emptyLabel} />}
      {rows.map((r) => (
        <div key={r.id} className="flex gap-1.5 items-center">
          <Input
            inputSize="sm"
            value={r.key}
            onChange={(e) => patch(r.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1"
          />
          <Input
            inputSize="sm"
            value={r.value}
            onChange={(e) => patch(r.id, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1"
          />
          <IconButton
            label="Remove row"
            icon={Trash2}
            size="sm"
            variant="ghost"
            onClick={() => remove(r.id)}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" block iconLeft={Plus} onClick={add}>
        {addLabel}
      </Button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Test-response status tone
   ══════════════════════════════════════════════════════════ */

function statusTone(code: number): BadgeTone {
  if (code >= 500) return 'danger';
  if (code >= 400) return 'warning';
  if (code >= 300) return 'info';
  return 'success';
}

/* ══════════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════════ */

export function HttpRequestSettings({ block, onBlockChange, variables = [] }: Props) {
  /* ── Derive options ───────────────────────────────── */
  const opts = (block.options ?? {}) as WebhookOptions;

  const method: HttpMethod = opts.method ?? 'GET';
  const url: string = opts.url ?? '';
  const headers: KVPair[] = opts.headers ?? [];
  const queryParams: KVPair[] = opts.queryParams ?? [];
  const body: WebhookBody =
    typeof opts.body === 'string'
      ? { type: 'json', content: opts.body }
      : opts.body ?? { type: 'json', content: '' };
  const responseMappings = opts.responseMappings ?? [];
  const timeout: number = opts.timeout ?? 30000;
  const saveFullResponse: boolean = opts.saveFullResponseToVariable ?? false;
  const fullResponseVarId: string | undefined = opts.fullResponseVariableId;
  const statusCodeVarId: string | undefined = opts.statusCodeVariableId;

  /* ── Local UI state ───────────────────────────────── */
  const [activeTab, setActiveTab] = useState<ActiveTab>('headers');
  const [testResult, setTestResult] = useState<{
    status: number;
    statusText: string;
    body: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testExpanded, setTestExpanded] = useState(true);

  /* ── Patch helper ─────────────────────────────────── */
  const update = useCallback(
    (patch: Partial<WebhookOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  /* ── Body helpers ─────────────────────────────────── */
  const updateBody = useCallback(
    (patch: Partial<WebhookBody>) => {
      update({ body: { ...body, ...patch } });
    },
    [body, update],
  );

  /* ── Test request ─────────────────────────────────── */
  const handleTest = useCallback(async () => {
    if (!url) return;
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);
    setTestExpanded(true);

    try {
      const headersObj: Record<string, string> = {};
      headers.forEach(({ key, value }) => {
        if (key.trim()) headersObj[key.trim()] = value;
      });

      // Build query string
      const queryParts = queryParams
        .filter((p) => p.key.trim())
        .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`);
      const finalUrl =
        queryParts.length > 0
          ? `${url}${url.includes('?') ? '&' : '?'}${queryParts.join('&')}`
          : url;

      const fetchInit: RequestInit = {
        method,
        headers: headersObj,
        signal: AbortSignal.timeout(timeout),
      };

      if (BODY_METHODS.includes(method)) {
        if (body.type === 'json' && body.content) {
          headersObj['Content-Type'] ??= 'application/json';
          fetchInit.body = body.content;
        } else if (body.type === 'raw' && body.content) {
          fetchInit.body = body.content;
        } else if (body.type === 'form-data' && body.formData) {
          const fd = new FormData();
          body.formData.forEach(({ key, value }) => {
            if (key.trim()) fd.append(key.trim(), value);
          });
          fetchInit.body = fd;
        }
      }

      const res = await fetch(finalUrl, fetchInit);
      const text = await res.text();
      let pretty: string;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        pretty = text;
      }
      setTestResult({ status: res.status, statusText: res.statusText, body: pretty });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTesting(false);
    }
  }, [url, method, headers, queryParams, body, timeout]);

  /* ── Tab config ───────────────────────────────────── */
  const showBody = BODY_METHODS.includes(method);

  const tabItems: { value: ActiveTab; label: React.ReactNode; disabled?: boolean }[] = [
    {
      value: 'headers',
      label: (
        <span className="inline-flex items-center gap-1">
          Headers
          {headers.length > 0 && (
            <Badge tone="neutral" kind="solid">
              {headers.length}
            </Badge>
          )}
        </span>
      ),
    },
    {
      value: 'params',
      label: (
        <span className="inline-flex items-center gap-1">
          Params
          {queryParams.length > 0 && (
            <Badge tone="neutral" kind="solid">
              {queryParams.length}
            </Badge>
          )}
        </span>
      ),
    },
    { value: 'body', label: 'Body', disabled: !showBody },
    { value: 'response', label: 'Response' },
  ];

  /* ── Render ───────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader compact>
        <PageHeaderHeading>
          <span className="inline-flex items-center gap-2">
            <Webhook size={16} aria-hidden="true" className="text-[var(--st-accent)]" />
            <PageTitle>HTTP Request</PageTitle>
          </span>
        </PageHeaderHeading>
      </PageHeader>

      {/* Method picker */}
      <Field label="Method">
        <SegmentedControl
          aria-label="HTTP method"
          fullWidth
          size="sm"
          value={method}
          onChange={(m) => update({ method: m as HttpMethod })}
          items={METHODS.map((m) => ({ value: m, label: m }))}
        />
      </Field>

      {/* URL input */}
      <Field label="URL">
        <Input
          type="url"
          value={url}
          onChange={(e) => update({ url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          spellCheck={false}
        />
      </Field>

      <Separator />

      {/* Tab strip */}
      <SegmentedControl
        aria-label="Request section"
        fullWidth
        size="sm"
        value={activeTab}
        onChange={(t) => setActiveTab(t as ActiveTab)}
        items={tabItems}
      />

      {/* ── Headers tab ─────────────────────────────── */}
      {activeTab === 'headers' && (
        <KVList
          rows={headers}
          keyPlaceholder="Header name"
          valuePlaceholder="Value or {{variable}}"
          emptyLabel="No headers yet."
          addLabel="Add header"
          onChange={(rows) => update({ headers: rows })}
        />
      )}

      {/* ── Query Params tab ─────────────────────────── */}
      {activeTab === 'params' && (
        <KVList
          rows={queryParams}
          keyPlaceholder="Param name"
          valuePlaceholder="Value or {{variable}}"
          emptyLabel="No query params yet."
          addLabel="Add param"
          onChange={(rows) => update({ queryParams: rows })}
        />
      )}

      {/* ── Body tab ──────────────────────────────────── */}
      {activeTab === 'body' && showBody && (
        <div className="space-y-3">
          {/* Body type selector */}
          <Field label="Encoding">
            <SegmentedControl
              aria-label="Body encoding"
              fullWidth
              size="sm"
              value={body.type}
              onChange={(t) => updateBody({ type: t as BodyType })}
              items={BODY_TYPES.map((bt) => ({ value: bt.value, label: bt.label }))}
            />
          </Field>

          {/* JSON body */}
          {body.type === 'json' && (
            <Field
              label="Body"
              help={
                <span>
                  Use{' '}
                  <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">
                    {'{{variable}}'}
                  </code>{' '}
                  to inject flow variables.
                </span>
              }
            >
              <Textarea
                value={body.content ?? ''}
                onChange={(e) => updateBody({ content: e.target.value })}
                placeholder={'{\n  "key": "{{variable}}"\n}'}
                rows={8}
                spellCheck={false}
                className="font-mono resize-y min-h-[120px]"
              />
            </Field>
          )}

          {/* Form-data body */}
          {body.type === 'form-data' && (
            <KVList
              rows={body.formData ?? []}
              keyPlaceholder="Field name"
              valuePlaceholder="Value or {{variable}}"
              emptyLabel="No form fields yet."
              addLabel="Add field"
              onChange={(rows) => updateBody({ formData: rows })}
            />
          )}

          {/* Raw body */}
          {body.type === 'raw' && (
            <Field label="Body">
              <Textarea
                value={body.content ?? ''}
                onChange={(e) => updateBody({ content: e.target.value })}
                placeholder="Raw request body..."
                rows={8}
                spellCheck={false}
                className="font-mono resize-y min-h-[120px]"
              />
            </Field>
          )}
        </div>
      )}

      {/* ── Response tab ─────────────────────────────── */}
      {activeTab === 'response' && (
        <div className="space-y-4">
          {/* Save full response toggle */}
          <Switch
            checked={saveFullResponse}
            onCheckedChange={(v) => update({ saveFullResponseToVariable: v })}
            label="Save full response to variable"
          />

          {saveFullResponse && (
            <Field label="Response variable">
              <VariableSelect
                variables={variables}
                value={fullResponseVarId}
                onChange={(id) => update({ fullResponseVariableId: id })}
                placeholder="Select variable"
              />
            </Field>
          )}

          <Field label="Save status code to">
            <VariableSelect
              variables={variables}
              value={statusCodeVarId}
              onChange={(id) => update({ statusCodeVariableId: id })}
              placeholder="Select variable"
            />
          </Field>

          <Separator />

          {/* JSON path mappings */}
          <div className="space-y-2">
            <span className="text-[11.5px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide block">
              JSON Path Mappings
            </span>
            <p className="text-[11px] text-[var(--st-text-tertiary)]">
              Extract values from the response using JSONPath expressions (e.g.{' '}
              <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-text)]">
                $.data.user.name
              </code>
              ).
            </p>

            {responseMappings.length === 0 && <EmptyState size="sm" title="No mappings yet." />}

            {responseMappings.map((m) => (
              <div key={m.id} className="flex gap-1.5 items-center">
                <Input
                  inputSize="sm"
                  value={m.jsonPath}
                  onChange={(e) =>
                    update({
                      responseMappings: responseMappings.map((x) =>
                        x.id === m.id ? { ...x, jsonPath: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="$.path.to.value"
                  className="flex-1 font-mono"
                />
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--st-text-tertiary)]"
                />
                <div className="flex-1">
                  <VariableSelect
                    variables={variables}
                    value={m.variableId}
                    onChange={(id) =>
                      update({
                        responseMappings: responseMappings.map((x) =>
                          x.id === m.id ? { ...x, variableId: id } : x,
                        ),
                      })
                    }
                    placeholder="Select variable"
                  />
                </div>
                <IconButton
                  label="Remove mapping"
                  icon={Trash2}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update({
                      responseMappings: responseMappings.filter((x) => x.id !== m.id),
                    })
                  }
                />
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              block
              iconLeft={Plus}
              onClick={() =>
                update({
                  responseMappings: [
                    ...responseMappings,
                    { id: createId(), jsonPath: '', variableId: undefined },
                  ],
                })
              }
            >
              Add mapping
            </Button>
          </div>

          <Separator />

          {/* Timeout */}
          <Field label="Timeout (ms)">
            <Input
              type="number"
              value={timeout}
              min={500}
              max={120000}
              step={500}
              onChange={(e) => update({ timeout: Number(e.target.value) })}
            />
          </Field>
        </div>
      )}

      <Separator />

      {/* Test button */}
      <Button
        variant="primary"
        block
        loading={isTesting}
        iconLeft={isTesting ? undefined : Play}
        disabled={!url.trim()}
        onClick={handleTest}
      >
        {isTesting ? 'Sending...' : 'Send test request'}
      </Button>

      {/* Test result panel */}
      {(testResult !== null || testError !== null) && (
        <Card className="overflow-hidden">
          {/* Result header */}
          <Button
            variant="ghost"
            block
            className="justify-between"
            aria-expanded={testExpanded}
            onClick={() => setTestExpanded((v) => !v)}
          >
            <span className="flex items-center gap-2">
              {testResult !== null ? (
                <>
                  <Badge tone={statusTone(testResult.status)} kind="soft">
                    {testResult.status}
                  </Badge>
                  <span className="text-[11px] text-[var(--st-text-secondary)]">
                    {testResult.statusText}
                  </span>
                </>
              ) : (
                <Badge tone="danger" kind="soft">
                  Error
                </Badge>
              )}
            </span>
            {testExpanded ? (
              <ChevronDown size={14} aria-hidden="true" className="text-[var(--st-text-tertiary)]" />
            ) : (
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="text-[var(--st-text-tertiary)]"
              />
            )}
          </Button>

          {/* Body */}
          {testExpanded && (
            <div className="border-t border-[var(--st-border)] p-3">
              <pre className="max-h-[280px] overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--st-text-secondary)]">
                {testResult !== null ? testResult.body : testError}
              </pre>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
