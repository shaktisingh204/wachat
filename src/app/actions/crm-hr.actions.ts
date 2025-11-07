
'use server';

import { getSession } from "@/app/actions/user.actions";
import { connectToDatabase } from "@/lib/mongodb";
import { getErrorMessage } from "@/lib/utils";
import { ObjectId, WithId } from "mongodb";
import type { CrmAttendance, CrmHoliday, CrmLeaveRequest, CrmGoal, CrmProfessionalTaxSlab, CrmEmployee } from '@/lib/definitions';
import { revalidatePath } from "next/cache";

export async function getCrmAttendance(date: Date): Promise<WithId<CrmAttendance>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));

        const attendance = await db.collection<CrmAttendance>('crm_attendance').find({
            userId: new ObjectId(session.user._id),
            date: { $gte: startOfDay, $lte: endOfDay }
        }).toArray();

        return JSON.parse(JSON.stringify(attendance));

    } catch (e) {
        console.error("Failed to fetch attendance:", e);
        return [];
    }
}

export async function markCrmAttendance(employeeId: string, status: CrmAttendance['status'], date: Date): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access Denied' };
    
    if (!employeeId || !status || !date) return { success: false, error: 'Missing required fields.' };

    try {
        const { db } = await connectToDatabase();
        const attendanceDate = new Date(date);
        attendanceDate.setHours(0,0,0,0);
        
        await db.collection('crm_attendance').updateOne(
            { 
                userId: new ObjectId(session.user._id),
                employeeId: new ObjectId(employeeId),
                date: attendanceDate
            },
            { $set: { status, updatedAt: new Date() } },
            { upsert: true }
        );
        revalidatePath('/dashboard/crm/hr-payroll/attendance');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Leave Management ---
export async function getCrmLeaveRequests(): Promise<WithId<CrmLeaveRequest>[]> {
     const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const requests = await db.collection<CrmLeaveRequest>('crm_leave_requests').aggregate([
            { $match: { userId: new ObjectId(session.user._id) } },
            { $sort: { startDate: -1 } },
            {
                $lookup: {
                    from: 'crm_employees',
                    localField: 'employeeId',
                    foreignField: '_id',
                    as: 'employeeInfo'
                }
            },
            { $unwind: '$employeeInfo' }
        ]).toArray();

        return JSON.parse(JSON.stringify(requests));
    } catch (e) {
        return [];
    }
}

export async function applyForCrmLeave(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access Denied' };

    try {
        const { db } = await connectToDatabase();

        // Find the employee record linked to the current user
        const employee = await db.collection('crm_employees').findOne({
            userId: new ObjectId(session.user._id),
            email: session.user.email,
        });

        if (!employee) {
            return { error: 'Your employee profile could not be found. Please contact your administrator.' };
        }

        const leaveData: Omit<CrmLeaveRequest, '_id' | 'createdAt'> = {
            userId: new ObjectId(session.user._id),
            employeeId: employee._id,
            leaveType: formData.get('leaveType') as string,
            startDate: new Date(formData.get('startDate') as string),
            endDate: new Date(formData.get('endDate') as string),
            reason: formData.get('reason') as string,
            status: 'Pending',
        };

        if (!leaveData.leaveType || !leaveData.startDate || !leaveData.endDate || !leaveData.reason) {
            return { error: 'All fields are required.' };
        }

        if (leaveData.endDate < leaveData.startDate) {
            return { error: 'End date cannot be before the start date.' };
        }

        await db.collection('crm_leave_requests').insertOne({ ...leaveData, createdAt: new Date() });

        revalidatePath('/dashboard/crm/hr-payroll/leave');
        return { message: 'Leave request submitted successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function approveOrRejectLeave(id: string, status: 'Approved' | 'Rejected'): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access Denied' };
    
    if (!id || !status) return { success: false, error: 'Missing required fields.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_leave_requests').updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(session.user._id) },
            { $set: { status } }
        );
        revalidatePath('/dashboard/crm/hr-payroll/leave');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Holidays ---
export async function getCrmHolidays(): Promise<WithId<CrmHoliday>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const holidays = await db.collection<CrmHoliday>('crm_holidays').find({
            userId: new ObjectId(session.user._id)
        }).sort({ date: 1 }).toArray();

        return JSON.parse(JSON.stringify(holidays));
    } catch (e) {
        console.error("Failed to fetch holidays:", e);
        return [];
    }
}

export async function saveCrmHoliday(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access Denied' };

    const name = formData.get('name') as string;
    const dateStr = formData.get('date') as string;

    if (!name || !dateStr) {
        return { error: 'Name and date are required.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const holidayData = {
            userId: new ObjectId(session.user._id),
            name,
            date: new Date(dateStr),
            createdAt: new Date(),
        };
        await db.collection('crm_holidays').insertOne(holidayData);
        revalidatePath('/dashboard/crm/hr-payroll/holidays');
        return { message: 'Holiday added successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmHoliday(id: string): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(id)) return { success: false, error: 'Invalid request' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_holidays').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        revalidatePath('/dashboard/crm/hr-payroll/holidays');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Goal Setting ---
export async function getCrmGoals(): Promise<WithId<CrmGoal>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const goals = await db.collection('crm_goals').aggregate([
            { $match: { userId: new ObjectId(session.user._id) } },
            { $lookup: { from: 'crm_employees', localField: 'assigneeId', foreignField: '_id', as: 'assigneeInfo' } },
            { $unwind: { path: '$assigneeInfo', preserveNullAndEmptyArrays: true } }
        ]).sort({ targetDate: 1 }).toArray();

        return JSON.parse(JSON.stringify(goals));
    } catch (e) {
        console.error("Failed to fetch goals:", e);
        return [];
    }
}

export async function saveCrmGoal(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access Denied' };

    const id = formData.get('id') as string | null;
    const goalData = {
        userId: new ObjectId(session.user._id),
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        assigneeId: formData.get('assigneeId') ? new ObjectId(formData.get('assigneeId') as string) : undefined,
        targetDate: new Date(formData.get('targetDate') as string),
        status: formData.get('status') as CrmGoal['status'],
        progress: Number(formData.get('progress')),
    };

    if (!goalData.title || !goalData.targetDate) return { error: 'Title and target date are required.' };

    try {
        const { db } = await connectToDatabase();
        if (id && ObjectId.isValid(id)) {
            await db.collection('crm_goals').updateOne({ _id: new ObjectId(id) }, { $set: goalData });
        } else {
            await db.collection('crm_goals').insertOne({ ...goalData, createdAt: new Date() } as any);
        }
        revalidatePath('/dashboard/crm/hr-payroll/goal-setting');
        return { message: 'Goal saved successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmGoal(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(id)) return { success: false, error: 'Invalid request' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_goals').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
        revalidatePath('/dashboard/crm/hr-payroll/goal-setting');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Professional Tax Slabs ---
export async function getCrmPtSlabs(): Promise<WithId<CrmProfessionalTaxSlab>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const slabs = await db.collection<CrmProfessionalTaxSlab>('crm_pt_slabs')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ state: 1, minSalary: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(slabs));
    } catch (e) {
        console.error("Failed to fetch PT slabs:", e);
        return [];
    }
}

export async function saveCrmPtSlab(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const slabId = formData.get('slabId') as string | null;
    const isEditing = !!slabId;

    try {
        const slabData = {
            userId: new ObjectId(session.user._id),
            state: formData.get('state') as string,
            minSalary: Number(formData.get('minSalary')),
            maxSalary: Number(formData.get('maxSalary')),
            taxAmount: Number(formData.get('taxAmount')),
        };

        if (!slabData.state || isNaN(slabData.minSalary) || isNaN(slabData.maxSalary) || isNaN(slabData.taxAmount)) {
            return { error: 'All fields are required and must be valid numbers.' };
        }

        const { db } = await connectToDatabase();
        if (isEditing && ObjectId.isValid(slabId)) {
            await db.collection('crm_pt_slabs').updateOne({ _id: new ObjectId(slabId), userId: slabData.userId }, { $set: slabData });
        } else {
            await db.collection('crm_pt_slabs').insertOne({ ...slabData, createdAt: new Date() });
        }
        
        revalidatePath('/dashboard/crm/hr-payroll/professional-tax');
        return { message: 'Professional Tax slab saved successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmPtSlab(slabId: string): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied" };

    if (!slabId || !ObjectId.isValid(slabId)) {
        return { success: false, error: 'Invalid Slab ID' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_pt_slabs').deleteOne({ _id: new ObjectId(slabId), userId: new ObjectId(session.user._id) });
        revalidatePath('/dashboard/crm/hr-payroll/professional-tax');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function generateProfessionalTaxReport(): Promise<any[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const [employees, slabs] = await Promise.all([
            db.collection('crm_employees').find({ userId, status: 'Active' }).project({ firstName: 1, lastName: 1, 'salaryDetails.grossSalary': 1, 'address.state': 1 }).toArray(),
            db.collection('crm_pt_slabs').find({ userId }).toArray()
        ]);
        
        const slabsByState = slabs.reduce((acc, slab) => {
            if (!acc[slab.state]) acc[slab.state] = [];
            acc[slab.state].push(slab);
            return acc;
        }, {} as Record<string, typeof slabs>);
        
        return employees.map(emp => {
            const state = emp.address?.state;
            const salary = emp.salaryDetails?.grossSalary || 0;
            let taxAmount = 0;

            if (state && slabsByState[state]) {
                const applicableSlab = slabsByState[state].find(s => salary >= s.minSalary && salary <= s.maxSalary);
                if (applicableSlab) {
                    taxAmount = applicableSlab.taxAmount;
                }
            }

            return {
                employeeId: emp._id.toString(),
                employeeName: `${emp.firstName} ${emp.lastName}`,
                state: state || 'N/A',
                grossSalary: salary,
                taxAmount,
            };
        });

    } catch (e) {
        console.error("Failed to generate professional tax report:", e);
        return [];
    }
}

    