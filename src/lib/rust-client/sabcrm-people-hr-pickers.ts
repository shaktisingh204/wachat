import 'server-only';

/**
 * SabCRM People — shared HR picker reader (leaves / shifts / rotations /
 * shift-changes surface group).
 *
 * Read-only client over the project-scoped employees mount
 * (`/v1/sabcrm/people/employees`, crate `crm-employees::project_router`)
 * used to back the kit `EntityPicker`s on the leave + shift surfaces.
 * Employees CRUD does NOT live here — the employees surface owns its own
 * client (`sabcrm-people-employees.ts`); this file deliberately exposes
 * only the search/resolve reads so the two surface groups never edit the
 * same module.
 *
 * Every method requires the active SabCRM `projectId` (the engine
 * rejects requests without it — `ScopeMode::Project`).
 *
 * Engine responses serialize `ObjectId`/`DateTime` as Mongo extended
 * JSON (`{$oid}`/`{$date}`); this module deflates them back into the
 * plain scalars the declared TS types advertise.
 */
import { rustFetch } from './fetcher';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type { CrmEmployeeDoc } from './crm-employees';

const EMPLOYEES_BASE = '/v1/sabcrm/people/employees';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Human label for an employee doc — never an ObjectId. */
export function employeeLabel(doc: CrmEmployeeDoc): string {
  const full = [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim();
  return doc.displayName?.trim() || full || 'Unnamed employee';
}

/** Secondary picker line (`employeeId · workEmail`). */
export function employeeMeta(doc: CrmEmployeeDoc): string | undefined {
  const parts = [doc.employeeId, doc.workEmail].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export const sabcrmPeopleHrPickersApi = {
  /** `GET /v1/sabcrm/people/employees` — picker search (bare array). */
  searchEmployees: async (
    projectId: string,
    q?: string,
    limit = 20,
  ): Promise<CrmEmployeeDoc[]> => {
    const docs = await rustFetch<CrmEmployeeDoc[]>(
      `${EMPLOYEES_BASE}${qs({ projectId, q, limit, page: 1 })}`,
    );
    return deflateDocs(docs);
  },

  /** `GET /v1/sabcrm/people/employees/{id}` — single resolve (throws on 404). */
  getEmployee: async (
    projectId: string,
    id: string,
  ): Promise<CrmEmployeeDoc> => {
    const doc = await rustFetch<CrmEmployeeDoc>(
      `${EMPLOYEES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return deflateDoc(doc);
  },
};

/**
 * Batch label resolution: unique ids → `Map<id, label>`. Missing /
 * foreign-scope ids simply don't land in the map (callers render a
 * muted fallback). Bounded fan-out (a list page has ≤ ~25 unique FKs).
 */
export async function resolveEmployeeLabels(
  projectId: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const doc = await sabcrmPeopleHrPickersApi.getEmployee(projectId, id);
        map.set(id, employeeLabel(doc));
      } catch {
        // 404 / scope-miss → leave unresolved; the UI renders a fallback.
      }
    }),
  );
  return map;
}
