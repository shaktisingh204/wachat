import 'server-only';

/**
 * SabCRM People — Payroll Settings client. Wraps the project-scoped
 * `/v1/sabcrm/people/payroll-settings` mount (crate
 * `crm-payroll-settings`, `project_router`) per people-suite
 * WI-14/WI-15/WI-16.
 *
 * Payroll settings are **singleton-per-scope** on this mount:
 * `GET /` returns the project's single document (`null` body when none
 * exists yet) and `PUT /` upserts it. There is deliberately no
 * `POST /` here — that would allow multiple settings docs per project.
 *
 * Wire shapes are re-used from `./crm-payroll-settings` (same crate,
 * same `crm_payroll_settings` collection).
 *
 * ⚠ The entity serializes ObjectId/DateTime fields as MongoDB extended
 * JSON (`{$oid}` / `{$date}`) — callers MUST pass fetched documents
 * through `deflateDoc` (`@/lib/sabcrm/finance-extjson`).
 */
import { rustFetch } from './fetcher';
import type {
  CrmPayrollSettingDoc,
  CrmPayrollSettingPayCycle,
  CrmPayrollSettingStatus,
  CrmPayrollSettingTaxSlab,
} from './crm-payroll-settings';

export type {
  CrmPayrollSettingDoc,
  CrmPayrollSettingPayCycle,
  CrmPayrollSettingStatus,
  CrmPayrollSettingTaxSlab,
} from './crm-payroll-settings';

/** `PUT /` body — only the fields explicitly sent are written. */
export interface SabcrmPayrollSettingsUpsertInput {
  companyName?: string;
  /** Employee PF deduction rate (percent, e.g. `12`). */
  pfRate?: number;
  /** Employee ESI deduction rate (percent, e.g. `0.75`). */
  esiRate?: number;
  payCycle?: CrmPayrollSettingPayCycle;
  taxSlabs?: CrmPayrollSettingTaxSlab[];
  defaultCurrency?: string;
  status?: CrmPayrollSettingStatus;
}

const BASE = '/v1/sabcrm/people/payroll-settings';

export const sabcrmPeoplePayrollSettingsApi = {
  /**
   * `GET /v1/sabcrm/people/payroll-settings` — the project's singleton
   * settings document, or `null` when none has been saved yet.
   */
  getSingleton: (projectId: string): Promise<CrmPayrollSettingDoc | null> =>
    rustFetch<CrmPayrollSettingDoc | null>(
      `${BASE}?projectId=${encodeURIComponent(projectId)}`,
    ),

  /** `PUT /` — singleton-per-scope upsert (WI-14). */
  upsert: (
    projectId: string,
    input: SabcrmPayrollSettingsUpsertInput,
  ): Promise<CrmPayrollSettingDoc> =>
    rustFetch<CrmPayrollSettingDoc>(
      `${BASE}?projectId=${encodeURIComponent(projectId)}`,
      { method: 'PUT', body: JSON.stringify({ ...input, projectId }) },
    ),
};
