
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '.';
import type { Project, Plan } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { handleSyncPhoneNumbers, handleSubscribeProjectWebhook } from './whatsapp.actions';

const API_VERSION = 'v23.0';

export async function exchangeCodeForTokens(code: string): Promise<{ accessToken?: string; error?: string }> {
    const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const appSecret = process.env.META_ONBOARDING_APP_SECRET;

    if (!appId || !appSecret) {
        return { error: 'Server is not configured for Meta OAuth.' };
    }

    try {
        // The redirect_uri is not needed for the server-to-server token exchange
        // when using the Embedded Signup flow with a code. The code is self-contained.
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`, {
            params: {
                client_id: appId,
                client_secret: appSecret,
                code: code,
            }
        });
        
        const accessToken = response.data.access_token;
        if (!accessToken) {
            throw new Error('Could not retrieve access token from Meta.');
        }

        return { accessToken };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleWabaOnboarding(data: {
    wabas: any[],
    phone_numbers: any[],
    business_id?: string,
    access_token: string,
    granted_scopes: string[],
}) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };
    
    if (!data.wabas || data.wabas.length === 0 || !data.phone_numbers || data.phone_numbers.length === 0) {
        return { error: 'Incomplete data received from Meta. Please try again.' };
    }

    try {
        const { db } = await connectToDatabase();
        const bulkOps = [];
        const hasCatalogManagement = data.granted_scopes.includes('catalog_management');

        for (const waba of data.wabas) {
            const projectData = {
                userId: new ObjectId(session.user._id),
                name: waba.name,
                wabaId: waba.id,
                businessId: data.business_id,
                appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID,
                accessToken: data.access_token,
                createdAt: new Date(),
                messagesPerSecond: 80,
                planId: session.user.plan?._id ? new ObjectId(session.user.plan._id) : undefined,
                credits: session.user.plan?.signupCredits || 0,
                hasCatalogManagement,
                phoneNumbers: data.phone_numbers
                    .filter(p => p.waba_id === waba.id)
                    .map(p => ({
                        id: p.id,
                        display_phone_number: p.display_phone_number,
                        verified_name: p.verified_name,
                        code_verification_status: 'VERIFIED',
                        quality_rating: 'GREEN',
                    })),
            };

            bulkOps.push({
                updateOne: {
                    filter: { userId: projectData.userId, wabaId: projectData.wabaId },
                    update: { $set: projectData, $setOnInsert: { createdAt: new Date() } },
                    upsert: true,
                },
            });
        }
        
        if (bulkOps.length > 0) {
            const result = await db.collection('projects').bulkWrite(bulkOps);
             if (result.upsertedIds) {
                for (const id of Object.values(result.upsertedIds)) {
                    const newProject = await db.collection<Project>('projects').findOne({_id: id});
                    if(newProject && newProject.wabaId && newProject.appId && newProject.accessToken) {
                        await handleSyncPhoneNumbers(newProject._id.toString());
                        await handleSubscribeProjectWebhook(newProject.wabaId, newProject.appId, newProject.accessToken);
                    }
                }
            }
        }

        revalidatePath('/dashboard');
        return { success: true, message: `${bulkOps.length} project(s) connected/updated.` };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
