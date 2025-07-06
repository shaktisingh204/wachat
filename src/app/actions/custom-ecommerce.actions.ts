
'use server';

import { getProjectById } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { EcommProduct, EcommOrder, EcommSettings } from '@/lib/definitions';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

export async function getEcommProducts(shopId: string) {
    // TODO: Implement
    return [];
}

export async function getEcommOrders(shopId: string) {
    // TODO: Implement
    return [];
}

export async function getEcommSettings(projectId: string): Promise<EcommSettings | null> {
    const project = await getProjectById(projectId);
    if (!project || !project.ecommSettings) {
        return null;
    }
    return project.ecommSettings;
}

export async function saveEcommShopSettings(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Project ID is missing.' };

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Access denied or project not found.' };

    try {
        const settings: EcommSettings = {
            shopName: formData.get('shopName') as string,
            currency: formData.get('currency') as string,
        };

        if (!settings.shopName || !settings.currency) {
            return { error: 'Shop Name and Currency are required.' };
        }

        const { db } = await connectToDatabase();
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { ecommSettings: settings } }
        );

        revalidatePath('/dashboard/custom-ecommerce/settings');
        return { message: 'Shop settings saved successfully!' };
    } catch (e: any) {
        return { error: 'Failed to save shop settings.' };
    }
}
