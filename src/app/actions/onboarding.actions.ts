
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

// Exchanges the short-lived authorization code for a long-lived access token.
async function exchangeCodeForTokens(code: string): Promise<{ accessToken?: string; error?: string }> {
    const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const appSecret = process.env.META_ONBOARDING_APP_SECRET;

    if (!appId || !appSecret) {
        return { error: 'Server is not configured for Meta OAuth. Missing App ID or Secret.' };
    }

    try {
        // The API returns a URL-encoded string, not JSON. We must request it as text.
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`, {
            params: {
                client_id: appId,
                client_secret: appSecret,
                code: code,
            },
            responseType: 'text' 
        });

        const responseParams = new URLSearchParams(response.data);
        const accessToken = responseParams.get('access_token');
        
        if (!accessToken) {
            let errorResponse;
            try {
                errorResponse = JSON.parse(response.data);
                if (errorResponse.error) {
                    throw new Error(errorResponse.error.message);
                }
            } catch (parseError) {
                // Ignore if parsing fails, it's not a JSON error.
            }
            throw new Error('Could not retrieve access token from Meta. The code may be invalid or expired.');
        }

        return { accessToken };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error("Token Exchange Error:", errorMessage);
        return { error: `Token Exchange Failed: ${errorMessage}` };
    }
}


// Handles the creation or update of projects after successful WABA onboarding.
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
        
        let planIdToAssign: ObjectId | undefined;
        let creditsToAssign: number = 0;

        if (user.planId && ObjectId.isValid(user.planId)) {
            planIdToAssign = user.planId;
            // User already has a plan, so they don't get new signup credits.
            creditsToAssign = user.credits || 0;
        } else {
            const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });
            if (defaultPlan) {
                planIdToAssign = defaultPlan._id;
                creditsToAssign = defaultPlan.signupCredits || 0;
            } else {
                // This is a critical configuration error. The system MUST have a default plan.
                throw new Error("System configuration error: No default plan is set for new users. Onboarding cannot proceed.");
            }
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
                planId: planIdToAssign,
                credits: creditsToAssign,
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
        return { success: true, message: `${bulkOps.length} project(s) connected/updated successfully.` };

    } catch (e: any) {
        console.error("Onboarding failed:", e);
        return { error: getErrorMessage(e) };
    }
}
