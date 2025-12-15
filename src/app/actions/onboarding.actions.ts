
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
    console.log('[ONBOARDING] Step 4a: Starting token exchange.');
    const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const appSecret = process.env.META_ONBOARDING_APP_SECRET;

    if (!appId || !appSecret) {
        console.error('[ONBOARDING] FATAL: Server is not configured for Meta OAuth. Missing App ID or Secret.');
        return { error: 'Server is not configured for Meta OAuth. Missing App ID or Secret.' };
    }
    
    // **DEFINITIVE FIX**: Use the hardcoded, correct redirect URI.
    const redirectUri = 'https://sabnode.com/auth/facebook/callback';

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`, {
            params: {
                client_id: appId,
                client_secret: appSecret,
                code: code,
                redirect_uri: redirectUri,
            },
            responseType: 'text' 
        });
        
        const responseParams = new URLSearchParams(response.data);
        const accessToken = responseParams.get('access_token');
        
        if (!accessToken) {
            console.error('[ONBOARDING] Token exchange failed. Response from Meta:', response.data);
            try {
                const errorResponse = JSON.parse(response.data);
                if (errorResponse.error) {
                    throw new Error(errorResponse.error.message);
                }
            } catch (parseError) {
                // If it's not JSON, it's an unexpected response format
            }
            throw new Error('Could not retrieve access token from Meta. The code may be invalid or expired.');
        }

        console.log('[ONBOARDING] Step 4b: Token exchange successful.');
        return { accessToken };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error("[ONBOARDING] Token Exchange Error:", errorMessage);
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
    console.log('[ONBOARDING] Step 1: Received onboarding data from client.');
    const session = await getSession();
    if (!session?.user) {
        console.error('[ONBOARDING] Error: Authentication required.');
        return { error: 'Authentication required' };
    }
    
    if (!data.wabas || data.wabas.length === 0 || !data.phone_numbers || data.phone_numbers.length === 0) {
        console.error('[ONBOARDING] Error: Incomplete data received from Meta.', data);
        return { error: 'Incomplete data received from Meta. Please ensure you select at least one phone number.' };
    }
     console.log('[ONBOARDING] Step 2: Onboarding data is valid.');

    try {
        console.log('[ONBOARDING] Step 3: Attempting to exchange code for access token.');
        const tokenResult = await exchangeCodeForTokens(data.code);
        if (tokenResult.error || !tokenResult.accessToken) {
            throw new Error(tokenResult.error || 'Failed to get access token.');
        }
        
        const accessToken = tokenResult.accessToken;
        console.log('[ONBOARDING] Step 4: Access token received.');
        const { db } = await connectToDatabase();
        
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });
        if (!user) throw new Error("User not found.");

        let planIdToAssign: ObjectId | undefined = user.planId;
        let creditsToAssign: number = user.credits || 0;

        // If user has no plan, assign the default one. This is a critical fallback.
        if (!planIdToAssign) {
            console.log('[ONBOARDING] User has no plan. Fetching default plan.');
            const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });
            if (!defaultPlan) {
                console.error("[ONBOARDING] FATAL: No default plan is set for new users. Onboarding cannot proceed.");
                throw new Error("System configuration error: No default plan is set for new users. Onboarding cannot proceed.");
            }
            planIdToAssign = defaultPlan._id;
            // Only assign signup credits if the user doesn't already have credits.
            if (!user.credits || user.credits === 0) {
                creditsToAssign = defaultPlan.signupCredits || 0;
            }
             console.log(`[ONBOARDING] Assigning default plan ID: ${planIdToAssign}`);
        } else {
             console.log(`[ONBOARDING] User has existing plan ID: ${planIdToAssign}`);
        }

        const hasCatalogManagement = data.granted_scopes.includes('catalog_management');
        const bulkOps = [];
        console.log(`[ONBOARDING] Step 5: Preparing to create/update ${data.wabas.length} project(s).`);

        for (const waba of data.wabas) {
            const projectData: Partial<Project> & { userId: ObjectId; wabaId: string; name: string, planId: ObjectId, credits: number } = {
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
                        code_verification_status: 'VERIFIED', // Assume verified if it comes through this flow
                        quality_rating: 'GREEN', // Assume green initially
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
            console.log('[ONBOARDING] Step 6: Executing database bulk write operation.');
            const result = await db.collection('projects').bulkWrite(bulkOps);
            console.log(`[ONBOARDING] Step 7: Database operation complete. Upserted IDs: ${Object.values(result.upsertedIds).length}, Modified: ${result.modifiedCount}`);
            
            const newProjectIds = Object.values(result.upsertedIds);
            
            if (newProjectIds.length > 0) {
                 console.log('[ONBOARDING] Step 8: Post-creation setup for new projects (webhook subscription & phone sync).');
                 for (const id of newProjectIds) {
                     const newProject = await db.collection<Project>('projects').findOne({_id: id});
                     if(newProject && newProject.wabaId && newProject.appId && newProject.accessToken) {
                         await handleSyncPhoneNumbers(newProject._id.toString());
                         await handleSubscribeProjectWebhook(newProject.wabaId, newProject.appId, newProject.accessToken);
                     }
                 }
            }
        }

        revalidatePath('/dashboard');
        console.log('[ONBOARDING] Step 9: Onboarding complete! Success response sent.');
        return { success: true, message: `Onboarding complete!` };

    } catch (e: any) {
        console.error("[ONBOARDING] Onboarding process failed:", e);
        return { error: getErrorMessage(e) };
    }
}
