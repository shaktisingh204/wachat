'use client';
import { useState } from 'react';
import {
  LuX,
  LuSettings2,
  LuSlidersHorizontal,
  LuGlobe,
  LuMail,
  LuClock,
  LuCode,
  LuGitBranch,
  LuTable2,
  LuMessageSquare,
  LuZap,
  LuPlay,
  LuDatabase,
  LuFileJson,
  LuType,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { N8NNode, LegacyN8NNodeType as N8NNodeType } from '../types';

/* ── Metadata registry ───────────────────────────────────── */

type NodeMeta = {
  label: string;
  icon: React.ElementType;
  color: string;
};

const NODE_META: Record<N8NNodeType, NodeMeta> = {
  'trigger.webhook': { label: 'Webhook',         icon: LuGlobe,            color: '#6366f1' },
  'trigger.schedule': { label: 'Schedule',        icon: LuClock,            color: '#0ea5e9' },
  'trigger.manual':   { label: 'Manual Trigger',  icon: LuPlay,             color: '#22c55e' },
  'action.http':      { label: 'HTTP Request',     icon: LuGlobe,            color: '#f59e0b' },
  'action.send_email':{ label: 'Send Email',       icon: LuMail,             color: '#ec4899' },
  'action.set_data':  { label: 'Set Data',         icon: LuDatabase,         color: '#8b5cf6' },
  'logic.if':         { label: 'IF',               icon: LuGitBranch,        color: '#f76808' },
  'logic.switch':     { label: 'Switch',           icon: LuSlidersHorizontal,color: '#f76808' },
  'logic.merge':      { label: 'Merge',            icon: LuGitBranch,        color: '#64748b' },
  'logic.split':      { label: 'Split',            icon: LuGitBranch,        color: '#64748b' },
  'transform.json':   { label: 'JSON Transform',   icon: LuFileJson,         color: '#10b981' },
  'transform.text':   { label: 'Text Transform',   icon: LuType,             color: '#10b981' },
  'transform.code':   { label: 'Code',             icon: LuCode,            color: '#7c3aed' },
  'integration.google_sheets': { label: 'Google Sheets', icon: LuTable2,   color: '#34a853' },
  'integration.slack':         { label: 'Slack',          icon: LuMessageSquare, color: '#4a154b' },
  'integration.whatsapp':      { label: 'WhatsApp',        icon: LuMessageSquare, color: '#25d366' },
};

const DEFAULT_META: NodeMeta = { label: 'Node', icon: LuZap, color: '#f76808' };

function getNodeMeta(type: N8NNodeType): NodeMeta {
  return NODE_META[type] ?? DEFAULT_META;
}

/* ── Shared field components ─────────────────────────────── */

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

const SELECT_CLS =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] outline-none focus:border-[#f76808] transition-colors appearance-none';

const TEXTAREA_CLS =
  'w-full min-h-[96px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] resize-y transition-colors';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--gray-10)]">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--gray-8)]">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5">
      {label && <span className="text-[12.5px] font-medium text-[var(--gray-12)]">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f76808]',
          checked ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* ── Node-specific parameter panels ──────────────────────── */

type ParamsProps = {
  node: N8NNode;
  onUpdate: (changes: Partial<N8NNode>) => void;
};

/** Convenience: update a single key inside node.parameters. */
function useParamSetter(node: N8NNode, onUpdate: (changes: Partial<N8NNode>) => void) {
  return function setParam(key: string, value: unknown) {
    onUpdate({ parameters: { ...node.parameters, [key]: value } });
  };
}

/* ── trigger.webhook ────────────────────────────────────── */
function WebhookParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Path" hint="Path segment appended to the base webhook URL.">
        <input
          type="text"
          className={INPUT_CLS}
          value={String(p.path ?? '')}
          onChange={(e) => set('path', e.target.value)}
          placeholder="my-webhook"
        />
      </Field>
      <Field label="HTTP Method">
        <select
          className={SELECT_CLS}
          value={String(p.method ?? 'POST')}
          onChange={(e) => set('method', e.target.value)}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Field>
      <Toggle
        label="Respond immediately"
        checked={Boolean(p.respondImmediately)}
        onChange={(v) => set('respondImmediately', v)}
      />
    </div>
  );
}

/* ── trigger.schedule ───────────────────────────────────── */
function ScheduleParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);
  const mode = String(p.triggerMode ?? 'cron');

  return (
    <div className="space-y-4">
      <Field label="Trigger Mode">
        <select
          className={SELECT_CLS}
          value={mode}
          onChange={(e) => set('triggerMode', e.target.value)}
        >
          <option value="cron">Cron Expression</option>
          <option value="interval">Fixed Interval</option>
        </select>
      </Field>

      {mode === 'cron' && (
        <Field label="Cron Expression" hint="Standard 5-part cron: minute hour day month weekday">
          <input
            type="text"
            className={INPUT_CLS}
            value={String(p.cronExpression ?? '0 9 * * 1-5')}
            onChange={(e) => set('cronExpression', e.target.value)}
            placeholder="0 9 * * 1-5"
          />
        </Field>
      )}

      {mode === 'interval' && (
        <>
          <Field label="Every">
            <input
              type="number"
              min={1}
              className={INPUT_CLS}
              value={Number(p.intervalValue ?? 1)}
              onChange={(e) => set('intervalValue', Number(e.target.value))}
            />
          </Field>
          <Field label="Unit">
            <select
              className={SELECT_CLS}
              value={String(p.intervalUnit ?? 'minutes')}
              onChange={(e) => set('intervalUnit', e.target.value)}
            >
              {['seconds', 'minutes', 'hours', 'days'].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </Field>
        </>
      )}

      <Field label="Timezone">
        <input
          type="text"
          className={INPUT_CLS}
          value={String(p.timezone ?? 'UTC')}
          onChange={(e) => set('timezone', e.target.value)}
          placeholder="UTC"
        />
      </Field>
    </div>
  );
}

/* ── action.http ────────────────────────────────────────── */
function HttpParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="URL">
        <input
          type="text"
          className={INPUT_CLS}
          value={String(p.url ?? '')}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://api.example.com/endpoint"
        />
      </Field>
      <Field label="Method">
        <select
          className={SELECT_CLS}
          value={String(p.method ?? 'GET')}
          onChange={(e) => set('method', e.target.value)}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Headers (JSON)" hint='{"Authorization": "Bearer {{token}}"}'>
        <textarea
          className={cn(TEXTAREA_CLS, 'font-mono text-[12px]')}
          value={String(p.headers ?? '{}')}
          onChange={(e) => set('headers', e.target.value)}
          placeholder="{}"
        />
      </Field>
      <Field label="Body (JSON)">
        <textarea
          className={cn(TEXTAREA_CLS, 'font-mono text-[12px]')}
          value={String(p.body ?? '')}
          onChange={(e) => set('body', e.target.value)}
          placeholder='{"key": "value"}'
        />
      </Field>
      <Toggle
        label="Send as form data"
        checked={Boolean(p.asFormData)}
        onChange={(v) => set('asFormData', v)}
      />
    </div>
  );
}

/* ── action.send_email ──────────────────────────────────── */
function SendEmailParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="To">
        <input type="text" className={INPUT_CLS} value={String(p.to ?? '')} onChange={(e) => set('to', e.target.value)} placeholder="recipient@example.com" />
      </Field>
      <Field label="CC">
        <input type="text" className={INPUT_CLS} value={String(p.cc ?? '')} onChange={(e) => set('cc', e.target.value)} placeholder="cc@example.com" />
      </Field>
      <Field label="Subject">
        <input type="text" className={INPUT_CLS} value={String(p.subject ?? '')} onChange={(e) => set('subject', e.target.value)} />
      </Field>
      <Field label="Body">
        <textarea className={TEXTAREA_CLS} value={String(p.body ?? '')} onChange={(e) => set('body', e.target.value)} />
      </Field>
      <Toggle label="HTML body" checked={Boolean(p.htmlBody)} onChange={(v) => set('htmlBody', v)} />
    </div>
  );
}

/* ── action.set_data ────────────────────────────────────── */
function SetDataParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Assignments (JSON)" hint='Set multiple keys at once: {"key": "{{value}}"}'>
        <textarea
          className={cn(TEXTAREA_CLS, 'font-mono text-[12px]')}
          value={String(p.assignments ?? '{}')}
          onChange={(e) => set('assignments', e.target.value)}
          placeholder='{"outputKey": "{{inputKey}}"}'
        />
      </Field>
      <Toggle label="Keep all incoming data" checked={Boolean(p.keepAll ?? true)} onChange={(v) => set('keepAll', v)} />
    </div>
  );
}

/* ── logic.if ───────────────────────────────────────────── */
function IfParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Left value" hint="Use {{variable}} syntax">
        <input type="text" className={INPUT_CLS} value={String(p.leftValue ?? '')} onChange={(e) => set('leftValue', e.target.value)} placeholder="{{data.field}}" />
      </Field>
      <Field label="Operator">
        <select className={SELECT_CLS} value={String(p.operator ?? 'equals')} onChange={(e) => set('operator', e.target.value)}>
          {[
            ['equals', 'equals'],
            ['notEquals', 'does not equal'],
            ['contains', 'contains'],
            ['notContains', 'does not contain'],
            ['startsWith', 'starts with'],
            ['endsWith', 'ends with'],
            ['gt', 'greater than'],
            ['gte', 'greater than or equal'],
            ['lt', 'less than'],
            ['lte', 'less than or equal'],
            ['empty', 'is empty'],
            ['notEmpty', 'is not empty'],
          ].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      {!['empty', 'notEmpty'].includes(String(p.operator ?? 'equals')) && (
        <Field label="Right value">
          <input type="text" className={INPUT_CLS} value={String(p.rightValue ?? '')} onChange={(e) => set('rightValue', e.target.value)} placeholder="expected value" />
        </Field>
      )}
      <div className="rounded-lg border border-dashed border-[var(--gray-5)] p-3 text-[11.5px] text-[var(--gray-9)]">
        <span className="font-medium text-[var(--gray-12)]">Output 0</span> — True branch
        <br />
        <span className="font-medium text-[var(--gray-12)]">Output 1</span> — False branch
      </div>
    </div>
  );
}

/* ── logic.switch ───────────────────────────────────────── */
function SwitchParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Value" hint="Expression to evaluate against each case">
        <input type="text" className={INPUT_CLS} value={String(p.value ?? '')} onChange={(e) => set('value', e.target.value)} placeholder="{{data.status}}" />
      </Field>
      <Field label="Cases (one per line)" hint="Each line becomes a separate output branch">
        <textarea
          className={TEXTAREA_CLS}
          value={String(p.cases ?? '')}
          onChange={(e) => set('cases', e.target.value)}
          placeholder={"active\npending\ncancelled"}
        />
      </Field>
      <Toggle label="Fallthrough to default" checked={Boolean(p.fallthrough)} onChange={(v) => set('fallthrough', v)} />
    </div>
  );
}

/* ── transform.code ─────────────────────────────────────── */
function CodeParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Language">
        <select className={SELECT_CLS} value={String(p.language ?? 'javascript')} onChange={(e) => set('language', e.target.value)}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python (experimental)</option>
        </select>
      </Field>
      <Field label="Code" hint="Use $input.all() to access incoming items.">
        <textarea
          className={cn(TEXTAREA_CLS, 'font-mono text-[12px] min-h-[160px]')}
          value={String(p.code ?? '')}
          onChange={(e) => set('code', e.target.value)}
          placeholder={`// Return an array of items\nreturn $input.all().map(item => ({\n  json: { ...item.json, processed: true }\n}));`}
          spellCheck={false}
        />
      </Field>
    </div>
  );
}

/* ── transform.json / transform.text ────────────────────── */
function JsonTransformParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Mode">
        <select className={SELECT_CLS} value={String(p.mode ?? 'stringify')} onChange={(e) => set('mode', e.target.value)}>
          <option value="stringify">Object → JSON string</option>
          <option value="parse">JSON string → Object</option>
        </select>
      </Field>
      <Field label="Field name" hint="Field containing the value to transform">
        <input type="text" className={INPUT_CLS} value={String(p.fieldName ?? '')} onChange={(e) => set('fieldName', e.target.value)} placeholder="data" />
      </Field>
    </div>
  );
}

/* ── integration.google_sheets ──────────────────────────── */
function GoogleSheetsParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Operation">
        <select className={SELECT_CLS} value={String(p.operation ?? 'read')} onChange={(e) => set('operation', e.target.value)}>
          <option value="read">Read rows</option>
          <option value="append">Append row</option>
          <option value="update">Update row</option>
          <option value="delete">Delete row</option>
        </select>
      </Field>
      <Field label="Spreadsheet ID">
        <input type="text" className={INPUT_CLS} value={String(p.spreadsheetId ?? '')} onChange={(e) => set('spreadsheetId', e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
      </Field>
      <Field label="Sheet name">
        <input type="text" className={INPUT_CLS} value={String(p.sheetName ?? 'Sheet1')} onChange={(e) => set('sheetName', e.target.value)} placeholder="Sheet1" />
      </Field>
    </div>
  );
}

/* ── integration.slack ──────────────────────────────────── */
function SlackParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Channel" hint="Channel name or ID, e.g. #general">
        <input type="text" className={INPUT_CLS} value={String(p.channel ?? '')} onChange={(e) => set('channel', e.target.value)} placeholder="#general" />
      </Field>
      <Field label="Message">
        <textarea className={TEXTAREA_CLS} value={String(p.message ?? '')} onChange={(e) => set('message', e.target.value)} placeholder="Hello {{user.name}}!" />
      </Field>
      <Toggle label="Post as bot" checked={Boolean(p.asBot ?? true)} onChange={(v) => set('asBot', v)} />
    </div>
  );
}

/* ── integration.whatsapp ───────────────────────────────── */
function WhatsAppParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="To (phone number)" hint="Include country code, e.g. +1234567890">
        <input type="text" className={INPUT_CLS} value={String(p.to ?? '')} onChange={(e) => set('to', e.target.value)} placeholder="+1234567890" />
      </Field>
      <Field label="Message">
        <textarea className={TEXTAREA_CLS} value={String(p.message ?? '')} onChange={(e) => set('message', e.target.value)} placeholder="Hello {{name}}!" />
      </Field>
      <Field label="Message type">
        <select className={SELECT_CLS} value={String(p.messageType ?? 'text')} onChange={(e) => set('messageType', e.target.value)}>
          <option value="text">Text</option>
          <option value="template">Template</option>
          <option value="image">Image</option>
          <option value="document">Document</option>
        </select>
      </Field>
    </div>
  );
}

/* ── Generic fallback ────────────────────────────────────── */
function GenericParams({ node }: ParamsProps) {
  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-4 text-center text-[12px] text-[var(--gray-9)]">
      <LuSettings2 className="mx-auto mb-2 h-5 w-5 opacity-40" strokeWidth={1.5} />
      No configuration panel for <strong>{node.type}</strong> yet.
    </div>
  );
}

/* ── Parameters router ────────────────────────────────────── */
function ParametersPanel(props: ParamsProps) {
  switch (props.node.type) {
    case 'trigger.webhook':        return <WebhookParams {...props} />;
    case 'trigger.schedule':       return <ScheduleParams {...props} />;
    case 'action.http':            return <HttpParams {...props} />;
    case 'action.send_email':      return <SendEmailParams {...props} />;
    case 'action.set_data':        return <SetDataParams {...props} />;
    case 'logic.if':               return <IfParams {...props} />;
    case 'logic.switch':           return <SwitchParams {...props} />;
    case 'transform.code':         return <CodeParams {...props} />;
    case 'transform.json':         return <JsonTransformParams {...props} />;
    case 'integration.google_sheets': return <GoogleSheetsParams {...props} />;
    case 'integration.slack':      return <SlackParams {...props} />;
    case 'integration.whatsapp':   return <WhatsAppParams {...props} />;
    default:                       return <GenericParams {...props} />;
  }
}

/* ── Settings panel ──────────────────────────────────────── */
function SettingsPanel({ node, onUpdate }: ParamsProps) {
  return (
    <div className="space-y-4">
      <Field label="Node name">
        <input
          type="text"
          className={INPUT_CLS}
          value={node.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Node name"
        />
      </Field>
      <Toggle
        label="Disabled"
        checked={Boolean(node.disabled)}
        onChange={(v) => onUpdate({ disabled: v })}
      />
      <Field label="Notes">
        <textarea
          className={TEXTAREA_CLS}
          value={String(node.parameters.notes ?? '')}
          onChange={(e) =>
            onUpdate({ parameters: { ...node.parameters, notes: e.target.value } })
          }
          placeholder="Add notes about this node…"
        />
      </Field>
    </div>
  );
}

/* ── Tabs ────────────────────────────────────────────────── */

type Tab = 'params' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'params',   label: 'Parameters' },
  { id: 'settings', label: 'Settings' },
];

/* ── NodePropertiesPanel ─────────────────────────────────── */

type Props = {
  node: N8NNode;
  onUpdate: (changes: Partial<N8NNode>) => void;
  onClose: () => void;
};

export function NodePropertiesPanel({ node, onUpdate, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('params');
  const meta = getNodeMeta(node.type as N8NNodeType);
  const Icon = meta.icon;

  return (
    <div className="w-[340px] shrink-0 flex flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 border-b border-[var(--gray-4)] px-4 py-3 shrink-0">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${meta.color}22`, color: meta.color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="flex-1 truncate text-[13px] font-semibold text-[var(--gray-12)]">
          {node.name || meta.label}
        </span>
        {node.disabled && (
          <span className="rounded bg-[var(--gray-4)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--gray-9)]">
            disabled
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          aria-label="Close panel"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 border-b border-[var(--gray-4)] bg-[var(--gray-1)] px-3 pt-2 pb-0 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-1.5 text-[12px] font-medium rounded-t-md transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-[#f76808] text-[#f76808]'
                : 'border-transparent text-[var(--gray-9)] hover:text-[var(--gray-12)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'params' ? (
          <ParametersPanel node={node} onUpdate={onUpdate} />
        ) : (
          <SettingsPanel node={node} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}
