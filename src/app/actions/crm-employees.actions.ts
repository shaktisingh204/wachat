'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { ObjectId, type WithId } from 'mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { CrmDepartment, CrmDesignation, CrmEmployee } from '@/lib/definitions';

// --- Departments ---
export async function getCrmDepartments(): Promise<WithId<CrmDepartment>[]> {
    const session = await getSession();
    if (!session?.user) return [];

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

export async function saveCrmDepartment(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    const name = formData.get('name') as string;
    if (!name) return { error: 'Department name is required.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_departments').insertOne({
            userId: new ObjectId(session.user._id),
            name,
            description: formData.get('description') as string | undefined,
        });
        revalidatePath('/dashboard/crm/hr-payroll/departments');
        return { message: 'Department added successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmDepartment(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_departments').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
        revalidatePath('/dashboard/crm/hr-payroll/departments');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Designations ---
export async function getCrmDesignations(): Promise<WithId<CrmDesignation>[]> {
    const session = await getSession();
    if (!session?.user) return [];

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

export async function saveCrmDesignation(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    const name = formData.get('name') as string;
    if (!name) return { error: 'Designation name is required.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_designations').insertOne({
            userId: new ObjectId(session.user._id),
            name,
            description: formData.get('description') as string | undefined,
        });
        revalidatePath('/dashboard/crm/hr-payroll/designations');
        return { message: 'Designation added successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmDesignation(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_designations').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
        revalidatePath('/dashboard/crm/hr-payroll/designations');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Employees ---
export async function getCrmEmployees(): Promise<WithId<any>[]> {
    const session = await getSession();
    if (!session?.user) return [];

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

export async function saveCrmEmployee(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const employeeId = formData.get('employeeId') as string | null;
    const isEditing = !!employeeId;

    const data: Partial<CrmEmployee> = {
        userId: new ObjectId(session.user._id),
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
        employeeId: formData.get('employeeIdCode') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string | undefined,
        status: formData.get('status') as CrmEmployee['status'],
        dateOfJoining: new Date(formData.get('dateOfJoining') as string),
        departmentId: formData.get('departmentId') ? new ObjectId(formData.get('departmentId') as string) : undefined,
        designationId: formData.get('designationId') ? new ObjectId(formData.get('designationId') as string) : undefined,
    };
    
    if (!data.firstName || !data.lastName || !data.email || !data.employeeId || !data.dateOfJoining) {
        return { error: 'Please fill all required fields.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        if (isEditing) {
            await db.collection('crm_employees').updateOne(
                { _id: new ObjectId(employeeId!) },
                { $set: data }
            );
        } else {
            await db.collection('crm_employees').insertOne({
                ...data,
                createdAt: new Date(),
                updatedAt: new Date()
            } as CrmEmployee);
        }
        revalidatePath('/dashboard/crm/hr-payroll/employees');
        return { message: `Employee ${isEditing ? 'updated' : 'added'} successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
