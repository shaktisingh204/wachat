
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '.';
import type { Project, User, Plan } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { handleSyncPhoneNumbers, handleSubscribeProjectWebhook } from './whatsapp.actions';

const API_VERSION = 'v23.0';

// This function now correctly handles the URL-encoded response from Meta.
async function exchangeCodeForTokens(code: string): Promise<{ accessToken?: string; error?: string }> {
    const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const appSecret = process.env.META_ONBOARDING_APP_SECRET;

    if (!appId || !appSecret) {
        return { error: 'Server is not configured for Meta OAuth. Missing App ID or Secret.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`, {
            params: {
                client_id: appId,
                client_secret: appSecret,
                code: code,
            },
            responseType: 'text' // Explicitly request a text response
        });

        // The response is a URL-encoded string, not JSON.
        const responseParams = new URLSearchParams(response.data);
        const accessToken = responseParams.get('access_token');
        
        if (!accessToken) {
            // If access_token is missing, there might be an error object in the response.
            let errorResponse;
            try {
                errorResponse = JSON.parse(response.data);
                if (errorResponse.error) {
                    throw new Error(errorResponse.error.message);
                }
            } catch (parseError) {} // Ignore if parsing fails, it's just not JSON
            throw new Error('Could not retrieve access token from Meta.');
        }

        return { accessToken };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error("Token Exchange Error:", errorMessage);
        return { error: `Token Exchange Failed: ${errorMessage}` };
    }
}

// This function is now more robust and handles data types correctly.
export async function handleWabaOnboarding(data: {
    wabas: any[],
    phone_numbers: any[],
    business_id?: string,
    code: string,
    granted_scopes: string[],
}) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };
    
    if (!data.wabas || data.wabas.length === 0 || !data.phone_numbers || data.phone_numbers.length === 0) {
        return { error: 'Incomplete data received from Meta. Please ensure you select at least one phone number.' };
    }

    try {
        const tokenResult = await exchangeCodeForTokens(data.code);
        if (tokenResult.error || !tokenResult.accessToken) {
            throw new Error(tokenResult.error || 'Failed to get access token.');
        }
        
        const accessToken = tokenResult.accessToken;
        const { db } = await connectToDatabase();
        const bulkOps = [];
        const hasCatalogManagement = data.granted_scopes.includes('catalog_management');

        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });
        if (!user) return { error: "User not found." };
        
        // This is the robust way to handle plan assignment.
        let planIdToAssign: ObjectId | undefined = user.planId;
        let creditsToAssign: number = user.credits || 0;

        // If user has no plan, fetch the default plan as a fallback.
        if (!planIdToAssign) {
            const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });
            if (defaultPlan) {
                planIdToAssign = defaultPlan._id;
                // Only assign signup credits if they are getting the default plan for the first time.
                // Assuming if they had no planId, they are a new user.
                creditsToAssign = defaultPlan.signupCredits || 0;
            }
        } else {
            // User already has a plan, so don't give them more signup credits.
            creditsToAssign = 0;
        }


        for (const waba of data.wabas) {
            const projectData: Partial<Project> & { userId: ObjectId; wabaId: string; name: string } = {
                userId: new ObjectId(session.user._id),
                name: waba.name,
                wabaId: waba.id,
                businessId: data.business_id,
                appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID,
                accessToken: accessToken,
                messagesPerSecond: 80,
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

            // Only assign plan and credits if a valid planId exists
            if (planIdToAssign) {
                projectData.planId = planIdToAssign;
                projectData.credits = creditsToAssign;
            }

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
