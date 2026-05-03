/**
 * Contract templates with merge-field rendering.
 *
 * Merge syntax: `{{path.to.field}}` — supports nested object paths and a
 * couple of optional helpers (`upper`, `lower`, `date`). Missing values
 * render as the empty string by default; pass `strict: true` to throw.
 */
import type { Contract, ContractTemplate, ContractStatus } from './types';

const MERGE_RE = /\{\{\s*([^}|\s]+)(?:\s*\|\s*(\w+))?\s*\}\}/g;

function randomId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}${rnd}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function applyHelper(value: unknown, helper?: string): string {
  const str = value == null ? '' : String(value);
  switch (helper) {
    case 'upper': return str.toUpperCase();
    case 'lower': return str.toLowerCase();
    case 'date':
      try {
        return new Date(str).toLocaleDateString();
      } catch {
        return str;
      }
    default: return str;
  }
}

export interface RenderOptions {
  strict?: boolean;
}

/**
 * Render a template body by replacing `{{merge}}` tokens against `data`.
 */
export function renderTemplate(
  body: string,
  data: Record<string, unknown>,
  options: RenderOptions = {},
): string {
  return body.replace(MERGE_RE, (_match, path: string, helper?: string) => {
    const value = getPath(data, path);
    if (value == null) {
      if (options.strict) {
        throw new Error(`Missing merge field: ${path}`);
      }
      return '';
    }
    return applyHelper(value, helper);
  });
}

/**
 * Extract declared merge fields from a template body. Useful for previewing
 * which inputs a template needs.
 */
export function extractMergeFields(body: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MERGE_RE.source, 'g');
  while ((m = re.exec(body)) !== null) {
    set.add(m[1]);
  }
  return Array.from(set).sort();
}

/**
 * Validate a template — surfaces missing required merge fields against
 * available data keys.
 */
export function validateTemplateData(
  template: ContractTemplate,
  data: Record<string, unknown>,
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const field of template.mergeFields) {
    if (getPath(data, field) == null) missing.push(field);
  }
  return { ok: missing.length === 0, missing };
}

export interface CreateContractInput {
  customerId: string;
  template: ContractTemplate;
  data: Record<string, unknown>;
  title?: string;
  dealId?: string;
  startDate?: string;
  endDate?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Build a `Contract` by rendering a template against caller-provided data.
 * The output's `body` is the merged string and `status` defaults to `draft`.
 */
export function createContract(input: CreateContractInput): Contract {
  const body = renderTemplate(input.template.body, input.data);
  let endDate = input.endDate;
  if (!endDate && input.startDate && input.template.defaultTermDays) {
    const start = new Date(input.startDate);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setDate(end.getDate() + input.template.defaultTermDays);
      endDate = end.toISOString();
    }
  }
  return {
    id: randomId('contract'),
    templateId: input.template.id,
    customerId: input.customerId,
    dealId: input.dealId,
    title: input.title ?? input.template.name,
    body,
    status: 'draft',
    startDate: input.startDate,
    endDate,
    metadata: input.metadata,
  };
}

export function transitionContract(c: Contract, status: ContractStatus): Contract {
  const next: Contract = { ...c, status };
  if (status === 'signed' && !c.signedAt) next.signedAt = nowIso();
  return next;
}

/**
 * Compute the renewal reminder date given a `daysBefore` window.
 */
export function withRenewalReminder(c: Contract, daysBefore: number): Contract {
  if (!c.endDate) return c;
  const end = new Date(c.endDate);
  if (Number.isNaN(end.getTime())) return c;
  const remind = new Date(end);
  remind.setDate(remind.getDate() - daysBefore);
  return { ...c, renewalReminderAt: remind.toISOString() };
}
