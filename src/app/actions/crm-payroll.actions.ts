
'use server';

import { getSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import type { CrmSalaryStructure, CrmPayslip } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';

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
