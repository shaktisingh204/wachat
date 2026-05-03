/**
 * Read-only HRM adapter for the cross-module Data Fabric.
 *
 * HRM stores employees in `crm_employees` (see `src/lib/definitions.ts →
 * CrmEmployee`). Each row carries a tenant `userId`, a stable `_id`
 * projected as `hrm_employee_id`, and the usual contact identifiers
 * (`email`, `phone`, optional `personalEmail`). Salary and reporting
 * structure remain HRM-internal — only safe public fields are mirrored
 * into the fabric as traits.
 */
import type { Collection, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { IdentityInput } from '../types';
import type { AdapterRow } from './wachat';

interface HrmEmployeeDoc extends Document {
  _id: ObjectId;
  userId?: ObjectId | string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  status?: string;
  departmentId?: ObjectId | string;
  designationId?: ObjectId | string;
  reportingManagerId?: ObjectId | string;
  workCountry?: string;
  workState?: string;
  workCity?: string;
}

const SOURCE = 'hrm';

async function getCollection(): Promise<Collection<HrmEmployeeDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<HrmEmployeeDoc>('crm_employees');
}

function asString(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  if (v instanceof ObjectId) return v.toHexString();
  return String(v);
}

export function mapHrmEmployee(doc: HrmEmployeeDoc): AdapterRow | null {
  const tenantId = asString(doc.userId);
  if (!tenantId) return null;

  const identities: IdentityInput[] = [
    {
      type: 'hrm_employee_id',
      value: doc._id.toHexString(),
      source: SOURCE,
    },
  ];
  if (doc.email && doc.email.trim()) {
    identities.push({ type: 'email', value: doc.email, source: SOURCE });
  }
  if (doc.personalEmail && doc.personalEmail.trim() && doc.personalEmail !== doc.email) {
    identities.push({ type: 'email', value: doc.personalEmail, source: SOURCE });
  }
  if (doc.phone && doc.phone.trim()) {
    identities.push({ type: 'phone', value: doc.phone, source: SOURCE });
  }

  const traits: Record<string, unknown> = {};
  if (doc.employeeId) traits.hrm_employee_code = doc.employeeId;
  if (doc.status) traits.hrm_status = doc.status;
  if (doc.departmentId) traits.hrm_department_id = asString(doc.departmentId);
  if (doc.designationId) traits.hrm_designation_id = asString(doc.designationId);
  if (doc.reportingManagerId) {
    traits.hrm_reporting_manager_id = asString(doc.reportingManagerId);
  }
  if (doc.workCountry) traits.hrm_work_country = doc.workCountry;
  if (doc.workState) traits.hrm_work_state = doc.workState;
  if (doc.workCity) traits.hrm_work_city = doc.workCity;

  const displayName =
    [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim() || undefined;

  return {
    externalId: doc._id.toHexString(),
    tenantId,
    displayName,
    identities,
    traits,
  };
}

export async function* iterateHrmEmployees(
  tenantId: string,
  opts: { limit?: number } = {},
): AsyncIterableIterator<AdapterRow> {
  const col = await getCollection();
  const filter: Record<string, unknown> = ObjectId.isValid(tenantId)
    ? { $or: [{ userId: new ObjectId(tenantId) }, { userId: tenantId }] }
    : { userId: tenantId };

  const cursor = col.find(filter);
  if (opts.limit && opts.limit > 0) cursor.limit(opts.limit);

  let yielded = 0;
  for await (const doc of cursor) {
    const row = mapHrmEmployee(doc);
    if (row) {
      yielded++;
      yield row;
      if (opts.limit && yielded >= opts.limit) break;
    }
  }
}

export async function listHrmEmployees(
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<AdapterRow[]> {
  const out: AdapterRow[] = [];
  for await (const row of iterateHrmEmployees(tenantId, opts)) out.push(row);
  return out;
}

export const HRM_ADAPTER_SOURCE = SOURCE;
