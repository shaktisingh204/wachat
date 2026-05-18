'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { CrmSalaryStructure, CrmPayslip, CrmEmployee } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
import { startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmPayslipsApi } from '@/lib/rust-client/crm-payslips';
import { crmSalaryStructuresApi } from '@/lib/rust-client/crm-salary-structures';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getSalaryStructures(): Promise<WithId<CrmSalaryStructure>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const { db } = await connectToDatabase();
    const structures = await db.collection<CrmSalaryStructure>('crm_salary_structures')
        .find({ userId: new ObjectId(session.user._id) })
        .toArray();

    return JSON.parse(JSON.stringify(structures));
}

export async function saveSalaryStructure(prevState: any, formData: FormData): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };

    const id = formData.get('id') as string | null;
    const guard = await requirePermission('crm_payroll', id && ObjectId.isValid(id) ? 'edit' : 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    const components = JSON.parse(formData.get('components') as string);
    const structureData = {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        components,
    };

    if (!structureData.name) {
        return { success: false, error: 'Structure name is required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const payload = {
            ...structureData,
            userId: new ObjectId(session.user._id),
        };

        if (id && ObjectId.isValid(id)) {
            await db.collection('crm_salary_structures').updateOne({ _id: new ObjectId(id) }, { $set: payload });
        } else {
            await db.collection('crm_salary_structures').insertOne({ ...payload, createdAt: new Date() } as CrmSalaryStructure);
        }

        revalidatePath('/dashboard/hrm/payroll/salary-structure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteSalaryStructure(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    const guard = await requirePermission('crm_payroll', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid ID' };
    }

    try {
        const { db } = await connectToDatabase();
        // Add check if structure is in use before deleting
        await db.collection('crm_salary_structures').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id)
        });
        revalidatePath('/dashboard/hrm/payroll/salary-structure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function generatePayrollData(month: number, year: number): Promise<{ payrollData?: any[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const employees = await db.collection<CrmEmployee>('crm_employees').find({ userId, status: 'Active' }).toArray();
        if (employees.length === 0) {
            return { payrollData: [] };
        }

        const salaryStructures = await db.collection<CrmSalaryStructure>('crm_salary_structures').find({ userId }).toArray();
        const structureMap = new Map(salaryStructures.map(s => [s._id.toString(), s]));

        const payPeriodStart = startOfMonth(new Date(year, month - 1));
        const payPeriodEnd = endOfMonth(new Date(year, month - 1));
        const daysInMonth = getDaysInMonth(payPeriodStart);

        const payrollData = employees.map(emp => {
            const grossSalary = emp.salaryDetails?.grossSalary || 0;
            const structure = emp.salaryDetails?.salaryStructureId ? structureMap.get(emp.salaryDetails.salaryStructureId.toString()) : undefined;

            // Mock attendance data for now
            const presentDays = Math.floor(Math.random() * 5) + 20;
            const absentDays = daysInMonth - presentDays;

            let earnings: { name: string, amount: number }[] = [];
            let deductions: { name: string, amount: number }[] = [];

            if (structure) {
                structure.components.forEach(comp => {
                    const amount = comp.calculationType === 'fixed' ? comp.value : (grossSalary * comp.value / 100);
                    if (comp.type === 'earning') earnings.push({ name: comp.name, amount });
                    else deductions.push({ name: comp.name, amount });
                });
            } else {
                // Fallback to basic calculation if no structure
                earnings.push({ name: 'Basic & DA', amount: grossSalary * 0.5 });
                earnings.push({ name: 'HRA', amount: grossSalary * 0.2 });
                earnings.push({ name: 'Other Allowances', amount: grossSalary * 0.3 });
                deductions.push({ name: 'Professional Tax', amount: 200 });
                deductions.push({ name: 'Provident Fund (PF)', amount: (grossSalary * 0.5) * 0.12 });
            }

            const totalEarnings = earnings.reduce((sum, item) => sum + item.amount, 0);
            const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
            const netSalary = totalEarnings - totalDeductions;

            return {
                employeeId: emp._id.toString(),
                employeeName: `${emp.firstName} ${emp.lastName}`,
                totalDays: daysInMonth,
                presentDays: presentDays,
                absentDays: absentDays,
                earnings,
                deductions,
                grossSalary: totalEarnings,
                netSalary,
            }
        });

        return { payrollData: JSON.parse(JSON.stringify(payrollData)) };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function processPayroll(payrollData: any[], month: number, year: number): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required' };

    const guard = await requirePermission('crm_payroll', 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const payPeriodStart = startOfMonth(new Date(year, month - 1));

        const payslipsToUpsert = payrollData.map(item => ({
            updateOne: {
                filter: { userId, employeeId: new ObjectId(item.employeeId), payPeriodStart },
                update: {
                    $set: {
                        userId,
                        employeeId: new ObjectId(item.employeeId),
                        payPeriodStart,
                        payPeriodEnd: endOfMonth(payPeriodStart),
                        earnings: item.earnings,
                        deductions: item.deductions,
                        grossSalary: item.grossSalary,
                        netPay: item.netSalary,
                        status: 'locked',
                        createdAt: new Date(),
                    }
                },
                upsert: true,
            }
        }));

        if (payslipsToUpsert.length > 0) {
            await db.collection('crm_payslips').bulkWrite(payslipsToUpsert);
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getPayslips(payPeriod: Date): Promise<WithId<CrmPayslip>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const payslips = await db.collection<CrmPayslip>('crm_payslips')
            .find({
                userId: new ObjectId(session.user._id),
                payPeriodStart: payPeriod
            })
            .toArray();
        return JSON.parse(JSON.stringify(payslips));
    } catch (e) {
        return [];
    }
}

/**
 * Fetch a single payslip document scoped to the current user.
 *
 * Dual-impl: when `USE_RUST_CRM=true`, defers to the Rust BFF; on failure
 * (or when disabled) falls back to a direct Mongo read.
 */
export async function getPayslipById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmPayslipsApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getPayslipById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'payslip',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_payslips').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch payslip by id:', e);
        return null;
    }
}

/**
 * Fetch a single salary-structure document scoped to the current user.
 *
 * Dual-impl: when `USE_RUST_CRM=true`, defers to the Rust BFF; on failure
 * (or when disabled) falls back to a direct Mongo read.
 */
export async function getSalaryStructureById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmSalaryStructuresApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getSalaryStructureById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'salary_structure',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_salary_structures').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch salary structure by id:', e);
        return null;
    }
}
