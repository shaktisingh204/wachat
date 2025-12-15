
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '.';
import type { Project, Plan, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { handleSyncPhoneNumbers, handleSubscribeProjectWebhook } from './whatsapp.actions';

const API_VERSION = 'v23.0';

export async function exchangeCodeForTokens(code: string): Promise<{ accessToken?: string; error?: string }> {
    const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const appSecret = process.env.META_ONBOARDING_APP_SECRET;

    if (!appId || !appSecret) {
        return { error: 'Server is not configured for Meta OAuth. Missing App ID or Secret.' };
    }

    try {
        // Facebook returns URL-encoded data, not JSON, so we request as text.
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`, {
            params: {
                client_id: appId,
                client_secret: appSecret,
                code: code,
            },
            responseType: 'text' 
        });

        // The response body is a string like "access_token=...&token_type=...".
        // We parse it as URL search parameters.
        const responseParams = new URLSearchParams(response.data);
        const accessToken = responseParams.get('access_token');
        
        if (!accessToken) {
            // Check if there's an error in the response from Facebook
            const errorResponse = JSON.parse(response.data);
            if (errorResponse.error) {
                throw new Error(errorResponse.error.message);
            }
            throw new Error('Could not retrieve access token from Meta.');
        }

        return { accessToken };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error("Token Exchange Error:", errorMessage);
        return { error: `Token Exchange Failed: ${errorMessage}` };
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
        return { error: 'Incomplete data received from Meta. Please ensure you select at least one phone number.' };
    }

    try {
        const { db } = await connectToDatabase();
        const bulkOps = [];
        const hasCatalogManagement = data.granted_scopes.includes('catalog_management');

        // Determine the plan ID to use
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });
        if (!user) return { error: "User not found." };
        
        let planIdToAssign: ObjectId | undefined = user.planId;
        let signupCredits = 0;
        
        if (!planIdToAssign) {
            const defaultPlan = await db.collection<WithId<Plan>>('plans').findOne({ isDefault: true });
            if (defaultPlan) {
                planIdToAssign = defaultPlan._id;
                signupCredits = defaultPlan.signupCredits || 0;
            }
        } else {
            const userPlan = await db.collection('plans').findOne({ _id: user.planId });
            signupCredits = userPlan?.signupCredits || 0;
        }

        for (const waba of data.wabas) {
            const projectData = {
                userId: new ObjectId(session.user._id),
                name: waba.name,
                wabaId: waba.id,
                businessId: data.business_id,
                appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID,
                accessToken: data.access_token,
                messagesPerSecond: 80,
                planId: planIdToAssign,
                credits: signupCredits,
                hasCatalogManagement,
                phoneNumbers: data.phone_numbers
                    .filter((p: any) => p.waba_id === waba.id)
                    .map((p: any) => ({
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
