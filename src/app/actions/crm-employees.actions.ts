'use server';

/**
 * CRM Employees / Departments / Designations server actions.
 *
 * **Dual implementation (departments + designations only):**
 *  - When `USE_RUST_CRM === 'true'`, the department + designation actions
 *    delegate to the Rust BFF (`/v1/crm/departments`, `/v1/crm/designations`)
 *    via `src/lib/rust-client/crm-departments.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *  - On any `RustApiError`, we log and fall back to the legacy path so
 *    users are never blocked by a transient BFF issue.
 *
 * Employee-related actions (`getCrmEmployees`, `saveCrmEmployee`, …) remain
 * direct-Mongo; they are NOT yet wired through the Rust BFF.
 *
 * Export shapes are identical across both paths so the existing pages at
 * `/dashboard/hrm/payroll/{departments,designations}` keep working.
 */

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { hashPassword } from '@/lib/auth';
import { ObjectId, type WithId } from 'mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { CrmDepartment, CrmDesignation, CrmEmployee } from '@/lib/definitions';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import {
    crmDepartmentsApi,
    crmDesignationsApi,
    type CrmDepartmentDoc,
    type CrmDesignationDoc,
} from '@/lib/rust-client/crm-departments';
import {
    crmEmployeesApi,
    type CrmEmployeeDoc,
} from '@/lib/rust-client/crm-employees';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Rust-shape → legacy snake_case adapters ─────────────────────────── */
//
// The legacy direct-Mongo path stored `parent_department_id`, `manager_id`,
// `department_id` (snake_case). Consumer pages still read those snake_case
// keys via `(dept as any).parent_department_id`. The Rust shape uses
// camelCase (`parentDepartmentId`, `headId`, `departmentId`). To keep the
// pages working we expose BOTH spellings on every returned row.

function rustDeptToLegacy(doc: CrmDepartmentDoc): WithId<CrmDepartment> {
    const out: Record<string, unknown> = {
        ...doc,
        _id: doc._id as unknown as ObjectId,
        userId: doc.userId as unknown as ObjectId,
        // snake_case aliases for the existing consumer page.
        parent_department_id: doc.parentDepartmentId,
        manager_id: doc.headId,
    };
    return out as unknown as WithId<CrmDepartment>;
}

function rustDesigToLegacy(doc: CrmDesignationDoc): WithId<CrmDesignation> {
    const out: Record<string, unknown> = {
        ...doc,
        _id: doc._id as unknown as ObjectId,
        userId: doc.userId as unknown as ObjectId,
        // snake_case aliases for the existing consumer page.
        department_id: doc.departmentId,
    };
    return out as unknown as WithId<CrmDesignation>;
}

/**
 * Adapt a Rust `CrmEmployeeDoc` (flattened camelCase) to the loose shape
 * `getCrmEmployees` consumers expect. The legacy aggregate pipeline joined
 * `crm_departments` / `crm_designations` to attach `departmentName` and
 * `designationName` — those name lookups happen inline here after the
 * Rust list returns.
 */
function rustEmpToLegacy(
    doc: CrmEmployeeDoc,
    deptNameById: Map<string, string>,
    desigNameById: Map<string, string>,
): WithId<unknown> {
    const departmentName = doc.departmentId
        ? deptNameById.get(String(doc.departmentId))
        : undefined;
    const designationName = doc.designationId
        ? desigNameById.get(String(doc.designationId))
        : undefined;
    return {
        ...doc,
        _id: doc._id as unknown as ObjectId,
        departmentName,
        designationName,
    } as unknown as WithId<unknown>;
}

// --- Departments ---
export async function getCrmDepartments(): Promise<WithId<CrmDepartment>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            // The Rust list endpoint returns a flat array (`Vec<Department>`).
            const items = await crmDepartmentsApi.list({ limit: 100 });
            return items.map(rustDeptToLegacy);
        } catch (e) {
            console.error('[getCrmDepartments] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'department', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const departments = await db.collection<CrmDepartment>('crm_departments')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(departments));
    } catch (e) {
        console.error("Failed to fetch departments:", e);
        return [];
    }
}

export async function saveCrmDepartment(_prev: any, formData: FormData): Promise<{ message?: string; error?: string; newDepartment?: any }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const _id = formData.get('_id') as string | null;
    const name = formData.get('name') as string;
    if (!name) return { error: 'Department name is required.' };

    const parentRaw = formData.get('parent_department_id') as string | null;
    const managerRaw = formData.get('manager_id') as string | null;
    const description = (formData.get('description') as string | null) || undefined;

    if (useRustCrm()) {
        try {
            const payload = {
                name,
                description,
                parentDepartmentId:
                    parentRaw && ObjectId.isValid(parentRaw) ? parentRaw : undefined,
                // Legacy `manager_id` maps to the Rust `headId` field.
                headId:
                    managerRaw && ObjectId.isValid(managerRaw) ? managerRaw : undefined,
            };

            if (_id && ObjectId.isValid(_id)) {
                const updated = await crmDepartmentsApi.update(_id, payload);
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'department',
                    entityId: _id,
                });
                revalidatePath('/dashboard/hrm/payroll/departments');
                return {
                    message: 'Department updated successfully.',
                    newDepartment: rustDeptToLegacy(updated),
                };
            }

            const created = await crmDepartmentsApi.create(payload);
            const createdId = created._id ?? '';
            if (createdId) {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'department',
                    entityId: String(createdId),
                });
            }
            revalidatePath('/dashboard/hrm/payroll/departments');
            return {
                message: 'Department added successfully.',
                newDepartment: rustDeptToLegacy(created),
            };
        } catch (e) {
            if (e instanceof RustApiError) {
                console.error('[saveCrmDepartment] rust path failed; falling back:', e);
                recordRustFallback({ entity: 'department', op: _id && ObjectId.isValid(_id) ? 'update' : 'create', errorCode: e.code, status: e.status });
                // fall through to legacy path
            } else {
                return { error: getErrorMessage(e) };
            }
        }
    }

    try {
        const { db } = await connectToDatabase();
        const data: Record<string, any> = {
            userId: new ObjectId(session.user._id),
            name,
            description,
            parent_department_id: parentRaw && ObjectId.isValid(parentRaw) ? new ObjectId(parentRaw) : undefined,
            manager_id: managerRaw && ObjectId.isValid(managerRaw) ? new ObjectId(managerRaw) : undefined,
            updatedAt: new Date(),
        };

        if (_id && ObjectId.isValid(_id)) {
            await db.collection('crm_departments').updateOne(
                { _id: new ObjectId(_id), userId: new ObjectId(session.user._id) },
                { $set: data },
            );
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'department',
                entityId: _id,
            });
            revalidatePath('/dashboard/hrm/payroll/departments');
            return { message: 'Department updated successfully.' };
        }

        data.createdAt = new Date();
        const result = await db.collection('crm_departments').insertOne(data);
        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'department',
            entityId: String(result.insertedId),
        });
        revalidatePath('/dashboard/hrm/payroll/departments');
        return { message: 'Department added successfully.', newDepartment: { ...data, _id: result.insertedId } };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmDepartment(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    if (useRustCrm()) {
        try {
            await crmDepartmentsApi.delete(id);
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'department',
                entityId: id,
            });
            revalidatePath('/dashboard/hrm/payroll/departments');
            return { success: true };
        } catch (e) {
            if (e instanceof RustApiError) {
                console.error('[deleteCrmDepartment] rust path failed; falling back:', e);
                recordRustFallback({ entity: 'department', op: 'delete', errorCode: e.code, status: e.status });
                // fall through
            } else {
                return { success: false, error: getErrorMessage(e) };
            }
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_departments').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'department',
            entityId: id,
        });
        revalidatePath('/dashboard/hrm/payroll/departments');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Designations ---
export async function getCrmDesignations(): Promise<WithId<CrmDesignation>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            const items = await crmDesignationsApi.list({ limit: 100 });
            return items.map(rustDesigToLegacy);
        } catch (e) {
            console.error('[getCrmDesignations] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'designation', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const designations = await db.collection<CrmDesignation>('crm_designations')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(designations));
    } catch (e) {
        console.error("Failed to fetch designations:", e);
        return [];
    }
}

export async function saveCrmDesignation(_prev: any, formData: FormData): Promise<{ message?: string; error?: string; newDesignation?: any }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const _id = formData.get('_id') as string | null;
    const name = formData.get('name') as string;
    if (!name) return { error: 'Designation name is required.' };

    const departmentIdRaw = formData.get('department_id') as string | null;
    const levelRaw = (formData.get('level') as string | null) || undefined;
    const description = (formData.get('description') as string | null) || undefined;

    if (useRustCrm()) {
        try {
            // Rust expects `level` as a u8; coerce here, drop unparseable values.
            let levelNum: number | undefined;
            if (levelRaw != null && levelRaw !== '') {
                const n = Number(levelRaw);
                levelNum = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined;
            }

            const payload = {
                name,
                description,
                departmentId:
                    departmentIdRaw && ObjectId.isValid(departmentIdRaw)
                        ? departmentIdRaw
                        : undefined,
                level: levelNum,
            };

            if (_id && ObjectId.isValid(_id)) {
                const updated = await crmDesignationsApi.update(_id, payload);
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'designation',
                    entityId: _id,
                });
                revalidatePath('/dashboard/hrm/payroll/designations');
                return {
                    message: 'Designation updated successfully.',
                    newDesignation: rustDesigToLegacy(updated),
                };
            }

            const created = await crmDesignationsApi.create(payload);
            const createdId = created._id ?? '';
            if (createdId) {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'designation',
                    entityId: String(createdId),
                });
            }
            revalidatePath('/dashboard/hrm/payroll/designations');
            return {
                message: 'Designation added successfully.',
                newDesignation: rustDesigToLegacy(created),
            };
        } catch (e) {
            if (e instanceof RustApiError) {
                console.error('[saveCrmDesignation] rust path failed; falling back:', e);
                recordRustFallback({ entity: 'designation', op: _id && ObjectId.isValid(_id) ? 'update' : 'create', errorCode: e.code, status: e.status });
                // fall through
            } else {
                return { error: getErrorMessage(e) };
            }
        }
    }

    try {
        const { db } = await connectToDatabase();
        const data: Record<string, any> = {
            userId: new ObjectId(session.user._id),
            name,
            description,
            department_id: departmentIdRaw && ObjectId.isValid(departmentIdRaw) ? new ObjectId(departmentIdRaw) : undefined,
            level: levelRaw,
            updatedAt: new Date(),
        };

        if (_id && ObjectId.isValid(_id)) {
            await db.collection('crm_designations').updateOne(
                { _id: new ObjectId(_id), userId: new ObjectId(session.user._id) },
                { $set: data },
            );
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'designation',
                entityId: _id,
            });
            revalidatePath('/dashboard/hrm/payroll/designations');
            return { message: 'Designation updated successfully.' };
        }

        data.createdAt = new Date();
        const result = await db.collection('crm_designations').insertOne(data);
        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'designation',
            entityId: String(result.insertedId),
        });
        revalidatePath('/dashboard/hrm/payroll/designations');
        return { message: 'Designation added successfully.', newDesignation: { ...data, _id: result.insertedId } };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmDesignation(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    if (useRustCrm()) {
        try {
            await crmDesignationsApi.delete(id);
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'designation',
                entityId: id,
            });
            revalidatePath('/dashboard/hrm/payroll/designations');
            return { success: true };
        } catch (e) {
            if (e instanceof RustApiError) {
                console.error('[deleteCrmDesignation] rust path failed; falling back:', e);
                recordRustFallback({ entity: 'designation', op: 'delete', errorCode: e.code, status: e.status });
                // fall through
            } else {
                return { success: false, error: getErrorMessage(e) };
            }
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_designations').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'designation',
            entityId: id,
        });
        revalidatePath('/dashboard/hrm/payroll/designations');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Employees ---
export async function getCrmEmployees(): Promise<WithId<any>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_employee', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            // The Rust list endpoint returns a flat array; we hydrate
            // departmentName/designationName client-side via parallel reads
            // against the (already Rust-backed) catalog endpoints.
            const [employees, departments, designations] = await Promise.all([
                crmEmployeesApi.list({ limit: 200 }),
                crmDepartmentsApi.list({ limit: 200 }).catch(() => [] as CrmDepartmentDoc[]),
                crmDesignationsApi.list({ limit: 200 }).catch(() => [] as CrmDesignationDoc[]),
            ]);
            const deptMap = new Map<string, string>();
            for (const d of departments) {
                if (d._id) deptMap.set(String(d._id), d.name ?? '');
            }
            const desigMap = new Map<string, string>();
            for (const d of designations) {
                if (d._id) desigMap.set(String(d._id), d.name ?? '');
            }
            return employees.map((e) => rustEmpToLegacy(e, deptMap, desigMap));
        } catch (e) {
            console.error('[getCrmEmployees] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'employee', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through to legacy
        }
    }

    try {
        const { db } = await connectToDatabase();
        const employees = await db.collection('crm_employees').aggregate([
            { $match: { userId: new ObjectId(session.user._id) } },
            { $lookup: { from: 'crm_departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
            { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
            { $lookup: { from: 'crm_designations', localField: 'designationId', foreignField: '_id', as: 'designation' } },
            { $unwind: { path: '$designation', preserveNullAndEmptyArrays: true } },
            { $addFields: { departmentName: '$department.name', designationName: '$designation.name' } },
            { $project: { department: 0, designation: 0 } },
            { $sort: { firstName: 1, lastName: 1 } }
        ]).toArray();
        return JSON.parse(JSON.stringify(employees));
    } catch (e) {
        console.error("Failed to fetch employees:", e);
        return [];
    }
}

export async function saveCrmEmployee(_prev: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const employeeId = formData.get('employeeId') as string | null;
    const isEditing = !!employeeId;

    const guard = await requirePermission('crm_employee', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    // `'employee'` is registered as a `WsCustomFieldBelongsTo` value
    // (handled below) — the rust path doesn't yet accept the full §1.P3
    // legacy detail bag (about_me, marital_status, bank_account…), so
    // saveCrmEmployee stays Mongo-only for now. The simple Rust-shaped
    // create/edit lives in `src/app/actions/crm/employees.actions.ts`
    // and is delegated to from the new HrEntityPage flow.
    // TODO 1.P3: dual-impl saveCrmEmployee once the Rust DTO grows the
    // detail-bag mirror (employee_details collection equivalent).
    void useRustCrm();

    const data: Partial<CrmEmployee> = {
        userId: new ObjectId(session.user._id),
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
        employeeId: formData.get('employeeIdCode') as string,
        email: formData.get('email') as string,
        phone: (formData.get('phone') as string | null) || undefined,
        status: formData.get('status') as CrmEmployee['status'],
        dateOfJoining: new Date(formData.get('dateOfJoining') as string),
        departmentId: formData.get('departmentId') ? new ObjectId(formData.get('departmentId') as string) : undefined,
        designationId: formData.get('designationId') ? new ObjectId(formData.get('designationId') as string) : undefined,
        workCountry: (formData.get('workCountry') as string | null) || undefined,
        workState: (formData.get('workState') as string | null) || undefined,
        workCity: (formData.get('workCity') as string | null) || undefined,
        salaryDetails: {
            grossSalary: Number(formData.get('grossSalary') || 0),
            salaryStructureId: formData.get('salaryStructureId') ? new ObjectId(formData.get('salaryStructureId') as string) : undefined,
        }
    };

    if (!data.firstName || !data.lastName || !data.email || !data.employeeId || !data.dateOfJoining) {
        return { error: 'Please fill all required fields.' };
    }

    const rawPassword = formData.get('password') as string | null;
    const imageUrl = formData.get('image') as string | null;

    if (imageUrl) {
        data.image = imageUrl;
    }

    const g = (k: string) => (formData.get(k) as string | null) || undefined;
    const gDate = (k: string) => { const v = formData.get(k) as string | null; return v ? new Date(v) : undefined; };
    const gNum = (k: string) => { const v = formData.get(k) as string | null; return v ? Number(v) : undefined; };

    const detailData: Record<string, any> = {
        userId: new ObjectId(session.user._id),
        about_me: g('about_me'),
        marital_status: g('marital_status'),
        gender: g('gender'),
        date_of_birth: gDate('date_of_birth'),
        blood_group: g('blood_group'),
        religion: g('religion'),
        nationality: g('nationality'),
        languages: g('languages'),
        hobbies: g('hobbies'),
        address: g('address'),
        marriage_anniversary_date: gDate('marriage_anniversary_date'),
        employment_type: g('employment_type'),
        probation_end_date: gDate('probation_end_date'),
        last_date: gDate('last_date'),
        notice_period_end_date: gDate('notice_period_end_date'),
        internship_end_date: gDate('internship_end_date'),
        contract_end_date: gDate('contract_end_date'),
        notice_period: gNum('notice_period'),
        reporting_to: g('ext_reporting_to'),
        overtime_hourly_rate: gNum('overtime_hourly_rate'),
        hourly_rate: gNum('hourly_rate'),
        slack_username: g('slack_username'),
        bank_account_id: (() => {
            const v = formData.get('ext_bank_account_id') as string | null;
            return v && ObjectId.isValid(v) ? v : undefined;
        })(),
        bank_account_number: g('bank_account_number'),
        bank_name: g('bank_name'),
        tax_regime: g('tax_regime'),
        work_anniversary_notified: formData.get('work_anniversary_notified') === 'true',
        updatedAt: new Date(),
    };
    // Remove undefined keys
    Object.keys(detailData).forEach(k => detailData[k] === undefined && delete detailData[k]);

    try {
        const { db } = await connectToDatabase();
        let resolvedEmployeeId: ObjectId;
        let employeeUserId: ObjectId | undefined;

        if (isEditing) {
            resolvedEmployeeId = new ObjectId(employeeId!);
            
            const existingEmployee = await db.collection<CrmEmployee>('crm_employees').findOne({ _id: resolvedEmployeeId });
            employeeUserId = existingEmployee?.employeeUserId;
            
            if (employeeUserId && rawPassword) {
                const hashedPassword = await hashPassword(rawPassword);
                await db.collection('users').updateOne(
                    { _id: employeeUserId },
                    { $set: { password: hashedPassword } }
                );
            }
            if (employeeUserId && imageUrl !== null) {
                await db.collection('users').updateOne(
                    { _id: employeeUserId },
                    { $set: { image: imageUrl || undefined } }
                );
            }

            await db.collection('crm_employees').updateOne(
                { _id: resolvedEmployeeId },
                { $set: { ...data, updatedAt: new Date() } }
            );
        } else {
            if (!rawPassword) {
                return { error: 'Password is required for new employees.' };
            }
            
            const existingUser = await db.collection('users').findOne({ email: data.email });
            if (existingUser) {
                employeeUserId = existingUser._id;
            } else {
                const hashedPassword = await hashPassword(rawPassword);
                const newUser = {
                    email: data.email,
                    name: `${data.firstName} ${data.lastName}`,
                    password: hashedPassword,
                    image: imageUrl || undefined,
                    createdAt: new Date(),
                };
                const userResult = await db.collection('users').insertOne(newUser as any);
                employeeUserId = userResult.insertedId;
            }

            const tenantProjects = await db.collection('projects').find({ userId: new ObjectId(session.user._id) }).toArray();
            for (const proj of tenantProjects) {
                 if (!proj.agents?.some((a: any) => a.userId.equals(employeeUserId))) {
                     await db.collection('projects').updateOne(
                         { _id: proj._id },
                         { $addToSet: { agents: { userId: employeeUserId, email: data.email, name: `${data.firstName} ${data.lastName}`, role: 'member' } } } as any
                     );
                 }
            }

            const result = await db.collection('crm_employees').insertOne({
                ...data,
                employeeUserId,
                createdAt: new Date(),
                updatedAt: new Date()
            } as CrmEmployee);
            resolvedEmployeeId = result.insertedId;
        }

        // Upsert extended profile detail
        await db.collection('crm_employee_details').updateOne(
            { employee_id: resolvedEmployeeId.toString(), userId: new ObjectId(session.user._id) },
            { $set: { ...detailData, employee_id: resolvedEmployeeId.toString() }, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
        );

        // Persist custom-field values for entity=employee. Best-effort —
        // a failure here doesn't unwind the employee insert/update.
        const cfRaw = formData.get('customFields');
        if (typeof cfRaw === 'string' && cfRaw.length > 0 && cfRaw !== '{}') {
            try {
                const parsed = JSON.parse(cfRaw);
                if (parsed && typeof parsed === 'object') {
                    await applyCustomFieldsToEntity(
                        'employee',
                        resolvedEmployeeId.toString(),
                        parsed,
                    );
                }
            } catch (e) {
                console.error('[saveCrmEmployee] customFields parse failed:', e);
            }
        }

        // §12.21 audit trail.
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: isEditing ? 'update' : 'create',
            entityKind: 'employee',
            entityId: resolvedEmployeeId.toString(),
        });

        revalidatePath('/dashboard/hrm/payroll/employees');
        revalidatePath('/dashboard/hrm/payroll/employees/profile');
        return { message: `Employee ${isEditing ? 'updated' : 'added'} successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Hard-delete an employee. Dual-implemented: when `USE_RUST_CRM === 'true'`
 * we delegate to the `/v1/crm/employees/:id` handler and fall back to the
 * legacy Mongo path on any `RustApiError`.
 *
 * The legacy fallback also clears the side-table `crm_employee_details`
 * row keyed on `employee_id` to keep the two collections consistent.
 */
export async function deleteCrmEmployee(id: string): Promise<{ success: boolean; error?: string }> {
    if (!id) return { success: false, error: 'Missing employee id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    const guard = await requirePermission('crm_employee', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmEmployeesApi.delete(id);
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'employee',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/hrm/payroll/employees');
            return { success: true };
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { success: false, error: 'Employee not found.' };
            }
            console.error('[deleteCrmEmployee] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'employee', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        await db.collection('crm_employees').deleteOne({ _id: new ObjectId(id), userId: userObjectId });
        // Side table — best-effort.
        try {
            await db.collection('crm_employee_details').deleteOne({
                employee_id: id,
                userId: userObjectId,
            });
        } catch {
            /* non-fatal */
        }
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'employee',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }
        revalidatePath('/dashboard/hrm/payroll/employees');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
