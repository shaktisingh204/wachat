
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { CrmVendor } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmVendors(projectId: string): Promise<WithId<CrmVendor>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const vendors = await db.collection<CrmVendor>('crm_vendors')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(vendors));
    } catch (e) {
        console.error("Failed to fetch CRM vendors:", e);
        return [];
    }
}

export async function saveCrmVendor(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const vendorId = formData.get('vendorId') as string | null;
    const isEditing = !!vendorId;

    if (!projectId) return { error: 'Project ID is missing.' };
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied or project not found.' };

    try {
        const vendorData: Omit<CrmVendor, '_id' | 'createdAt'> = {
            projectId: new ObjectId(projectId),
            name: formData.get('name') as string,
            contactPerson: formData.get('contactPerson') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            address: formData.get('address') as string,
            updatedAt: new Date(),
        };

        if (!vendorData.name) {
            return { error: 'Vendor name is required.' };
        }

        const { db } = await connectToDatabase();
        if (isEditing && ObjectId.isValid(vendorId)) {
            await db.collection('crm_vendors').updateOne({ _id: new ObjectId(vendorId), projectId: new ObjectId(projectId) }, { $set: vendorData });
        } else {
            vendorData.createdAt = new Date();
            await db.collection('crm_vendors').insertOne(vendorData as CrmVendor);
        }
        
        revalidatePath('/dashboard/crm/inventory/vendors');
        return { message: `Vendor "${vendorData.name}" saved successfully!` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmVendor(vendorId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(vendorId)) return { success: false, error: 'Invalid Vendor ID.' };
    
    const { db } = await connectToDatabase();
    const vendor = await db.collection('crm_vendors').findOne({ _id: new ObjectId(vendorId) });
    if (!vendor) return { success: false, error: 'Vendor not found.' };

    const hasAccess = await getProjectById(vendor.projectId.toString());
    if(!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        await db.collection('crm_vendors').deleteOne({ _id: new ObjectId(vendorId) });
        revalidatePath(`/dashboard/crm/inventory/vendors`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
