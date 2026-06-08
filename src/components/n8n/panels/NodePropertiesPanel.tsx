'use client';

import {
  X,
  Settings2,
  SlidersHorizontal,
  Globe,
  Mail,
  Clock,
  Code,
  GitBranch,
  Table2,
  MessageSquare,
  Zap,
  Play,
  Database,
  FileJson,
  Type,
} from 'lucide-react';
import {
  cn,
  Field,
  Input,
  Textarea,
  Switch,
  Badge,
  IconButton,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/sabcrm/20ui';
import type { N8NNode, LegacyN8NNodeType as N8NNodeType } from '../types';

/* ── Metadata registry ───────────────────────────────────── */

type NodeMeta = {
  label: string;
  icon: React.ElementType;
  color: string;
};

const NODE_META: Record<N8NNodeType, NodeMeta> = {
  'trigger.webhook': { label: 'Webhook',         icon: Globe,             color: '#6366f1' },
  'trigger.schedule': { label: 'Schedule',        icon: Clock,             color: '#0ea5e9' },
  'trigger.manual':   { label: 'Manual Trigger',  icon: Play,              color: '#22c55e' },
  'action.http':      { label: 'HTTP Request',     icon: Globe,             color: '#f59e0b' },
  'action.send_email':{ label: 'Send Email',       icon: Mail,              color: '#ec4899' },
  'action.set_data':  { label: 'Set Data',         icon: Database,          color: '#8b5cf6' },
  'logic.if':         { label: 'IF',               icon: GitBranch,         color: '#f76808' },
  'logic.switch':     { label: 'Switch',           icon: SlidersHorizontal, color: '#f76808' },
  'logic.merge':      { label: 'Merge',            icon: GitBranch,         color: '#64748b' },
  'logic.split':      { label: 'Split',            icon: GitBranch,         color: '#64748b' },
  'transform.json':   { label: 'JSON Transform',   icon: FileJson,          color: '#10b981' },
  'transform.text':   { label: 'Text Transform',   icon: Type,              color: '#10b981' },
  'transform.code':   { label: 'Code',             icon: Code,              color: '#7c3aed' },
  'integration.google_sheets': { label: 'Google Sheets', icon: Table2,      color: '#34a853' },
  'integration.slack':         { label: 'Slack',          icon: MessageSquare, color: '#4a154b' },
  'integration.whatsapp':      { label: 'WhatsApp',        icon: MessageSquare, color: '#25d366' },
};

const DEFAULT_META: NodeMeta = { label: 'Node', icon: Zap, color: '#f76808' };

function getNodeMeta(type: N8NNodeType): NodeMeta {
  return NODE_META[type] ?? DEFAULT_META;
}

/* ── Shared field helpers ────────────────────────────────── */

const MONO_CLS = 'font-mono text-[12px]';

/**
 * Small wrapper so a `Select` opens as a labelled control with a placeholder.
 * Renders a single-select listbox over the 20ui compound Select API.
 */
function SelectControl({
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  options,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
      <Field label="Path" help="Path segment appended to the base webhook URL.">
        <Input
          type="text"
          value={String(p.path ?? '')}
          onChange={(e) => set('path', e.target.value)}
          placeholder="my-webhook"
        />
      </Field>
      <Field label="HTTP Method">
        <SelectControl
          ariaLabel="HTTP Method"
          value={String(p.method ?? 'POST')}
          onValueChange={(v) => set('method', v)}
          options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY'].map((m) => ({ value: m, label: m }))}
        />
      </Field>
      <Switch
        label="Respond immediately"
        checked={Boolean(p.respondImmediately)}
        onCheckedChange={(v) => set('respondImmediately', v)}
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
        <SelectControl
          ariaLabel="Trigger Mode"
          value={mode}
          onValueChange={(v) => set('triggerMode', v)}
          options={[
            { value: 'cron', label: 'Cron Expression' },
            { value: 'interval', label: 'Fixed Interval' },
          ]}
        />
      </Field>

      {mode === 'cron' && (
        <Field label="Cron Expression" help="Standard 5-part cron: minute hour day month weekday">
          <Input
            type="text"
            value={String(p.cronExpression ?? '0 9 * * 1-5')}
            onChange={(e) => set('cronExpression', e.target.value)}
            placeholder="0 9 * * 1-5"
          />
        </Field>
      )}

      {mode === 'interval' && (
        <>
          <Field label="Every">
            <Input
              type="number"
              min={1}
              value={Number(p.intervalValue ?? 1)}
              onChange={(e) => set('intervalValue', Number(e.target.value))}
            />
          </Field>
          <Field label="Unit">
            <SelectControl
              ariaLabel="Unit"
              value={String(p.intervalUnit ?? 'minutes')}
              onValueChange={(v) => set('intervalUnit', v)}
              options={['seconds', 'minutes', 'hours', 'days'].map((u) => ({ value: u, label: u }))}
            />
          </Field>
        </>
      )}

      <Field label="Timezone">
        <Input
          type="text"
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
        <Input
          type="text"
          value={String(p.url ?? '')}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://api.example.com/endpoint"
        />
      </Field>
      <Field label="Method">
        <SelectControl
          ariaLabel="Method"
          value={String(p.method ?? 'GET')}
          onValueChange={(v) => set('method', v)}
          options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }))}
        />
      </Field>
      <Field label="Headers (JSON)" help='{"Authorization": "Bearer {{token}}"}'>
        <Textarea
          rows={4}
          className={MONO_CLS}
          value={String(p.headers ?? '{}')}
          onChange={(e) => set('headers', e.target.value)}
          placeholder="{}"
        />
      </Field>
      <Field label="Body (JSON)">
        <Textarea
          rows={4}
          className={MONO_CLS}
          value={String(p.body ?? '')}
          onChange={(e) => set('body', e.target.value)}
          placeholder='{"key": "value"}'
        />
      </Field>
      <Switch
        label="Send as form data"
        checked={Boolean(p.asFormData)}
        onCheckedChange={(v) => set('asFormData', v)}
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
        <Input type="text" value={String(p.to ?? '')} onChange={(e) => set('to', e.target.value)} placeholder="recipient@example.com" />
      </Field>
      <Field label="CC">
        <Input type="text" value={String(p.cc ?? '')} onChange={(e) => set('cc', e.target.value)} placeholder="cc@example.com" />
      </Field>
      <Field label="Subject">
        <Input type="text" value={String(p.subject ?? '')} onChange={(e) => set('subject', e.target.value)} />
      </Field>
      <Field label="Body">
        <Textarea rows={4} value={String(p.body ?? '')} onChange={(e) => set('body', e.target.value)} />
      </Field>
      <Switch label="HTML body" checked={Boolean(p.htmlBody)} onCheckedChange={(v) => set('htmlBody', v)} />
    </div>
  );
}

/* ── action.set_data ────────────────────────────────────── */
function SetDataParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Assignments (JSON)" help='Set multiple keys at once: {"key": "{{value}}"}'>
        <Textarea
          rows={4}
          className={MONO_CLS}
          value={String(p.assignments ?? '{}')}
          onChange={(e) => set('assignments', e.target.value)}
          placeholder='{"outputKey": "{{inputKey}}"}'
        />
      </Field>
      <Switch label="Keep all incoming data" checked={Boolean(p.keepAll ?? true)} onCheckedChange={(v) => set('keepAll', v)} />
    </div>
  );
}

/* ── logic.if ───────────────────────────────────────────── */
function IfParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="Left value" help="Use {{variable}} syntax">
        <Input type="text" value={String(p.leftValue ?? '')} onChange={(e) => set('leftValue', e.target.value)} placeholder="{{data.field}}" />
      </Field>
      <Field label="Operator">
        <SelectControl
          ariaLabel="Operator"
          value={String(p.operator ?? 'equals')}
          onValueChange={(v) => set('operator', v)}
          options={[
            { value: 'equals', label: 'equals' },
            { value: 'notEquals', label: 'does not equal' },
            { value: 'contains', label: 'contains' },
            { value: 'notContains', label: 'does not contain' },
            { value: 'startsWith', label: 'starts with' },
            { value: 'endsWith', label: 'ends with' },
            { value: 'gt', label: 'greater than' },
            { value: 'gte', label: 'greater than or equal' },
            { value: 'lt', label: 'less than' },
            { value: 'lte', label: 'less than or equal' },
            { value: 'empty', label: 'is empty' },
            { value: 'notEmpty', label: 'is not empty' },
          ]}
        />
      </Field>
      {!['empty', 'notEmpty'].includes(String(p.operator ?? 'equals')) && (
        <Field label="Right value">
          <Input type="text" value={String(p.rightValue ?? '')} onChange={(e) => set('rightValue', e.target.value)} placeholder="expected value" />
        </Field>
      )}
      <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-3 text-[11.5px] text-[var(--st-text-tertiary)]">
        <span className="font-medium text-[var(--st-text)]">Output 0</span> - True branch
        <br />
        <span className="font-medium text-[var(--st-text)]">Output 1</span> - False branch
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
      <Field label="Value" help="Expression to evaluate against each case">
        <Input type="text" value={String(p.value ?? '')} onChange={(e) => set('value', e.target.value)} placeholder="{{data.status}}" />
      </Field>
      <Field label="Cases (one per line)" help="Each line becomes a separate output branch">
        <Textarea
          rows={4}
          value={String(p.cases ?? '')}
          onChange={(e) => set('cases', e.target.value)}
          placeholder={"active\npending\ncancelled"}
        />
      </Field>
      <Switch label="Fallthrough to default" checked={Boolean(p.fallthrough)} onCheckedChange={(v) => set('fallthrough', v)} />
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
        <SelectControl
          ariaLabel="Language"
          value={String(p.language ?? 'javascript')}
          onValueChange={(v) => set('language', v)}
          options={[
            { value: 'javascript', label: 'JavaScript' },
            { value: 'python', label: 'Python (experimental)' },
          ]}
        />
      </Field>
      <Field label="Code" help="Use $input.all() to access incoming items.">
        <Textarea
          rows={8}
          className={cn(MONO_CLS, 'min-h-[160px]')}
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
        <SelectControl
          ariaLabel="Mode"
          value={String(p.mode ?? 'stringify')}
          onValueChange={(v) => set('mode', v)}
          options={[
            { value: 'stringify', label: 'Object to JSON string' },
            { value: 'parse', label: 'JSON string to Object' },
          ]}
        />
      </Field>
      <Field label="Field name" help="Field containing the value to transform">
        <Input type="text" value={String(p.fieldName ?? '')} onChange={(e) => set('fieldName', e.target.value)} placeholder="data" />
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
        <SelectControl
          ariaLabel="Operation"
          value={String(p.operation ?? 'read')}
          onValueChange={(v) => set('operation', v)}
          options={[
            { value: 'read', label: 'Read rows' },
            { value: 'append', label: 'Append row' },
            { value: 'update', label: 'Update row' },
            { value: 'delete', label: 'Delete row' },
          ]}
        />
      </Field>
      <Field label="Spreadsheet ID">
        <Input type="text" value={String(p.spreadsheetId ?? '')} onChange={(e) => set('spreadsheetId', e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
      </Field>
      <Field label="Sheet name">
        <Input type="text" value={String(p.sheetName ?? 'Sheet1')} onChange={(e) => set('sheetName', e.target.value)} placeholder="Sheet1" />
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
      <Field label="Channel" help="Channel name or ID, e.g. #general">
        <Input type="text" value={String(p.channel ?? '')} onChange={(e) => set('channel', e.target.value)} placeholder="#general" />
      </Field>
      <Field label="Message">
        <Textarea rows={4} value={String(p.message ?? '')} onChange={(e) => set('message', e.target.value)} placeholder="Hello {{user.name}}!" />
      </Field>
      <Switch label="Post as bot" checked={Boolean(p.asBot ?? true)} onCheckedChange={(v) => set('asBot', v)} />
    </div>
  );
}

/* ── integration.whatsapp ───────────────────────────────── */
function WhatsAppParams({ node, onUpdate }: ParamsProps) {
  const p = node.parameters;
  const set = useParamSetter(node, onUpdate);

  return (
    <div className="space-y-4">
      <Field label="To (phone number)" help="Include country code, e.g. +1234567890">
        <Input type="text" value={String(p.to ?? '')} onChange={(e) => set('to', e.target.value)} placeholder="+1234567890" />
      </Field>
      <Field label="Message">
        <Textarea rows={4} value={String(p.message ?? '')} onChange={(e) => set('message', e.target.value)} placeholder="Hello {{name}}!" />
      </Field>
      <Field label="Message type">
        <SelectControl
          ariaLabel="Message type"
          value={String(p.messageType ?? 'text')}
          onValueChange={(v) => set('messageType', v)}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'template', label: 'Template' },
            { value: 'image', label: 'Image' },
            { value: 'document', label: 'Document' },
          ]}
        />
      </Field>
    </div>
  );
}

/* ── Generic fallback ────────────────────────────────────── */
function GenericParams({ node }: ParamsProps) {
  return (
    <EmptyState
      icon={Settings2}
      title="No configuration panel"
      description={`There is no configuration panel for ${node.type} yet.`}
      size="sm"
    />
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
        <Input
          type="text"
          value={node.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Node name"
        />
      </Field>
      <Switch
        label="Disabled"
        checked={Boolean(node.disabled)}
        onCheckedChange={(v) => onUpdate({ disabled: v })}
      />
      <Field label="Notes">
        <Textarea
          rows={4}
          value={String(node.parameters.notes ?? '')}
          onChange={(e) =>
            onUpdate({ parameters: { ...node.parameters, notes: e.target.value } })
          }
          placeholder="Add notes about this node."
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
  const meta = getNodeMeta(node.type as N8NNodeType);
  const Icon = meta.icon;

  return (
    <div className="20ui w-[340px] shrink-0 flex flex-col border-l border-[var(--st-border)] bg-[var(--st-bg)] z-20 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 border-b border-[var(--st-border)] px-4 py-3 shrink-0">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
          style={{ background: `${meta.color}22`, color: meta.color }}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <span className="flex-1 truncate text-[13px] font-semibold text-[var(--st-text)]">
          {node.name || meta.label}
        </span>
        {node.disabled && (
          <Badge tone="neutral">disabled</Badge>
        )}
        <IconButton label="Close panel" icon={X} size="sm" onClick={onClose} />
      </div>

      {/* ── Tabbed body ── */}
      <Tabs defaultValue="params" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="border-b border-[var(--st-border)] px-3 shrink-0">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="params" className="flex-1 overflow-y-auto p-4">
          <ParametersPanel node={node} onUpdate={onUpdate} />
        </TabsContent>
        <TabsContent value="settings" className="flex-1 overflow-y-auto p-4">
          <SettingsPanel node={node} onUpdate={onUpdate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
