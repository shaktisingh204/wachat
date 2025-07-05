
'use server';

import { getSession, handleSyncPhoneNumbers } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import type { Project, Plan } from '@/lib/definitions';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import { revalidatePath } from 'next/cache';

export async function handleManualWachatSetup(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { error: 'You must be logged in to create a project.' };
    }

    const wabaId = formData.get('wabaId') as string;
    const appId = formData.get('appId') as string;
    const accessToken = formData.get('accessToken') as string;
    const includeCatalog = formData.get('includeCatalog') === 'on';

    if (!wabaId || !appId || !accessToken) {
        return { error: 'WABA ID, App ID, and Access Token are required.' };
    }

    try {
        let businessId: string | undefined = undefined;
        if(includeCatalog) {
            const businessesResponse = await axios.get(`https://graph.facebook.com/v22.0/me/businesses`, {
                params: { access_token: accessToken }
            });
            const businesses = businessesResponse.data.data;
            if (businesses && businesses.length > 0) {
                businessId = businesses[0].id;
            } else {
                console.warn("Could not find a Meta Business Account associated with this token to enable Catalog features.");
            }
        }
        
        const projectDetailsResponse = await fetch(`https://graph.facebook.com/v22.0/${wabaId}?fields=name&access_token=${accessToken}`);
        const projectData = await projectDetailsResponse.json();

        if (projectData.error) {
            return { error: `Meta API Error (fetching project name): ${projectData.error.message}` };
        }

        const { db } = await connectToDatabase();
        
        const existingProject = await db.collection('projects').findOne({ wabaId: wabaId });
        if(existingProject) {
            return { error: 'A project with this WABA ID already exists.'};
        }

        const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });
        
        const newProject: Omit<Project, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: projectData.name,
            wabaId: wabaId,
            appId: appId,
            businessId: businessId,
            accessToken: accessToken,
            phoneNumbers: [],
            createdAt: new Date(),
            messagesPerSecond: 3000,
            planId: defaultPlan?._id,
            credits: defaultPlan?.signupCredits || 0,
            hasCatalogManagement: includeCatalog,
        };

        const result = await db.collection('projects').insertOne(newProject as any);
        
        if(result.insertedId) {
            await handleSyncPhoneNumbers(result.insertedId.toString());
        }

        revalidatePath('/dashboard');
        
        return { message: `Project "${projectData.name}" created successfully!` };

    } catch (e: any) {
        console.error('Manual project creation failed:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}
