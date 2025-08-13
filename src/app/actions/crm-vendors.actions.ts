
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmVendor } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmVendors(): Promise<WithId<CrmVendor>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const vendors = await db.collection<CrmVendor>('crm_vendors')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(vendors));
    } catch (e) {
        console.error("Failed to fetch CRM vendors:", e);
        return [];
    }
}

export async function saveCrmVendor(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const vendorId = formData.get('vendorId') as string | null;
    const isEditing = !!vendorId;

    try {
        const vendorData: Partial<Omit<CrmVendor, '_id' | 'createdAt'>> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            country: formData.get('country') as string,
            state: formData.get('state') as string,
            city: formData.get('city') as string,
            pincode: formData.get('pincode') as string,
            street: formData.get('street') as string,
            gstin: formData.get('gstin') as string,
            pan: formData.get('pan') as string,
            panName: formData.get('panName') as string,
            vendorType: formData.get('vendorType') as CrmVendor['vendorType'],
            subject: formData.get('subject') as string,
            bankAccountDetails: JSON.parse(formData.get('bankAccountDetails') as string || '{}'),
            updatedAt: new Date(),
        };

        if (!vendorData.name) {
            return { error: 'Vendor name is required.' };
        }

        const { db } = await connectToDatabase();
        if (isEditing && ObjectId.isValid(vendorId)) {
            await db.collection('crm_vendors').updateOne({ _id: new ObjectId(vendorId), userId: new ObjectId(session.user._id) }, { $set: vendorData });
        } else {
            vendorData.createdAt = new Date();
            await db.collection('crm_vendors').insertOne(vendorData as CrmVendor);
        }
        
        revalidatePath('/dashboard/crm/purchases/vendors');
        return { message: `Vendor "${vendorData.name}" saved successfully!` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmVendor(vendorId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(vendorId)) return { success: false, error: 'Invalid Vendor ID.' };
    
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const { db } = await connectToDatabase();
    const vendor = await db.collection('crm_vendors').findOne({ _id: new ObjectId(vendorId), userId: new ObjectId(session.user._id) });
    if (!vendor) return { success: false, error: 'Vendor not found or you do not have permission.' };
    
    try {
        await db.collection('crm_vendors').deleteOne({ _id: new ObjectId(vendorId) });
        revalidatePath(`/dashboard/crm/purchases/vendors`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
