
'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
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

export async function saveCrmDepartment(_prev: any, formData: FormData): Promise<{ message?: string; error?: string; newDepartment?: any }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const _id = formData.get('_id') as string | null;
    const name = formData.get('name') as string;
    if (!name) return { error: 'Department name is required.' };

    const parentRaw = formData.get('parent_department_id') as string | null;
    const managerRaw = formData.get('manager_id') as string | null;

    try {
        const { db } = await connectToDatabase();
        const data: Record<string, any> = {
            userId: new ObjectId(session.user._id),
            name,
            description: (formData.get('description') as string | null) || undefined,
            parent_department_id: parentRaw && ObjectId.isValid(parentRaw) ? new ObjectId(parentRaw) : undefined,
            manager_id: managerRaw && ObjectId.isValid(managerRaw) ? new ObjectId(managerRaw) : undefined,
            updatedAt: new Date(),
        };

        if (_id && ObjectId.isValid(_id)) {
            await db.collection('crm_departments').updateOne(
                { _id: new ObjectId(_id), userId: new ObjectId(session.user._id) },
                { $set: data },
            );
            revalidatePath('/dashboard/hrm/payroll/departments');
            return { message: 'Department updated successfully.' };
        }

        data.createdAt = new Date();
        const result = await db.collection('crm_departments').insertOne(data);
        revalidatePath('/dashboard/hrm/payroll/departments');
        return { message: 'Department added successfully.', newDepartment: { ...data, _id: result.insertedId } };
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
    const level = (formData.get('level') as string | null) || undefined;

    try {
        const { db } = await connectToDatabase();
        const data: Record<string, any> = {
            userId: new ObjectId(session.user._id),
            name,
            description: (formData.get('description') as string | null) || undefined,
            department_id: departmentIdRaw && ObjectId.isValid(departmentIdRaw) ? new ObjectId(departmentIdRaw) : undefined,
            level,
            updatedAt: new Date(),
        };

        if (_id && ObjectId.isValid(_id)) {
            await db.collection('crm_designations').updateOne(
                { _id: new ObjectId(_id), userId: new ObjectId(session.user._id) },
                { $set: data },
            );
            revalidatePath('/dashboard/hrm/payroll/designations');
            return { message: 'Designation updated successfully.' };
        }

        data.createdAt = new Date();
        const result = await db.collection('crm_designations').insertOne(data);
        revalidatePath('/dashboard/hrm/payroll/designations');
        return { message: 'Designation added successfully.', newDesignation: { ...data, _id: result.insertedId } };
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

        if (isEditing) {
            resolvedEmployeeId = new ObjectId(employeeId!);
            await db.collection('crm_employees').updateOne(
                { _id: resolvedEmployeeId },
                { $set: { ...data, updatedAt: new Date() } }
            );
        } else {
            const result = await db.collection('crm_employees').insertOne({
                ...data,
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

        revalidatePath('/dashboard/hrm/payroll/employees');
        revalidatePath('/dashboard/hrm/payroll/employees/profile');
        return { message: `Employee ${isEditing ? 'updated' : 'added'} successfully.` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
