
'use server';

import { getSession } from '@/app/actions/index.ts';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { CrmSalaryStructure, CrmPayslip, CrmEmployee } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
import { startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';

export async function getSalaryStructures(): Promise<WithId<CrmSalaryStructure>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    
    const { db } = await connectToDatabase();
    const structures = await db.collection<CrmSalaryStructure>('crm_salary_structures')
        .find({ userId: new ObjectId(session.user._id) })
        .toArray();
    
    return JSON.parse(JSON.stringify(structures));
}

export async function saveSalaryStructure(data: Omit<CrmSalaryStructure, '_id' | 'userId' | 'createdAt'> & { id?: string }): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };

    const { id, ...structureData } = data;

    try {
        const { db } = await connectToDatabase();
        const payload = {
            ...structureData,
            userId: new ObjectId(session.user._id),
        };

        if (id) {
            await db.collection('crm_salary_structures').updateOne({ _id: new ObjectId(id) }, { $set: payload });
        } else {
            await db.collection('crm_salary_structures').insertOne({ ...payload, createdAt: new Date() } as CrmSalaryStructure);
        }
        
        revalidatePath('/dashboard/crm/hr-payroll/salary-structure');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteSalaryStructure(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid ID' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_salary_structures').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id)
        });
        revalidatePath('/dashboard/crm/hr-payroll/salary-structure');
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
        
        const payPeriodStart = startOfMonth(new Date(year, month - 1));
        const payPeriodEnd = endOfMonth(new Date(year, month - 1));
        const daysInMonth = getDaysInMonth(payPeriodStart);

        const payrollData = employees.map(emp => {
            const grossSalary = emp.salaryDetails?.grossSalary || 0;
            // Mock data for now
            const presentDays = Math.floor(Math.random() * 5) + 20; // 20-24 days
            const absentDays = daysInMonth - presentDays;
            
            const earnings = [
                { name: 'Basic & DA', amount: grossSalary * 0.5 },
                { name: 'HRA', amount: grossSalary * 0.2 },
                { name: 'Other Allowances', amount: grossSalary * 0.3 },
            ];
            const totalEarnings = earnings.reduce((sum, item) => sum + item.amount, 0);

            const deductions = [
                { name: 'Professional Tax', amount: 200 },
                { name: 'Provident Fund (PF)', amount: totalEarnings * 0.12 },
            ];
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
    
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const payslipsToInsert: Omit<CrmPayslip, '_id'>[] = payrollData.map(item => ({
            userId,
            employeeId: new ObjectId(item.employeeId),
            payPeriodStart: startOfMonth(new Date(year, month - 1)),
            payPeriodEnd: endOfMonth(new Date(year, month - 1)),
            earnings: item.earnings,
            deductions: item.deductions,
            grossSalary: item.grossSalary,
            netPay: item.netSalary,
            status: 'locked',
            createdAt: new Date(),
        }));
        
        if (payslipsToInsert.length > 0) {
            await db.collection('crm_payslips').insertMany(payslipsToInsert as any);
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

