
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
    console.log('[ONBOARDING] Step 2: Starting token exchange with Meta.');
    const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const appSecret = process.env.META_ONBOARDING_APP_SECRET;
    const redirectUri = 'https://sabnode.com/auth/facebook/callback';

    if (!appId || !appSecret) {
        const errorMsg = '[ONBOARDING] FATAL: Server is not configured for Meta OAuth. Missing App ID or Secret.';
        console.error(errorMsg);
        return { error: 'Server is not configured for Meta OAuth. Missing App ID or Secret.' };
    }
    
    try {
        const params = new URLSearchParams();
        params.append('client_id', appId);
        params.append('client_secret', appSecret);
        params.append('redirect_uri', redirectUri);
        params.append('code', code);
        
        const url = `https://graph.facebook.com/${API_VERSION}/oauth/access_token`;
        console.log(`[ONBOARDING] Step 2.1: Sending POST to ${url}.`);

        const response = await axios.post(url, params);

        console.log('[ONBOARDING] Step 2.3: Received response from Meta:', response.data);
        
        const accessToken = response.data.access_token;
        
        if (!accessToken) {
            const errorMsg = 'Could not retrieve access token from Meta. The code may be invalid or expired.';
            console.error('[ONBOARDING] Token exchange failed. Response from Meta:', response.data);
            throw new Error(errorMsg);
        }

        console.log('[ONBOARDING] Step 3: Token exchange successful. Long-lived access token received.');
        return { accessToken };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error("[ONBOARDING] Token Exchange Error:", errorMessage, e.response?.data || '');
        return { error: `Token Exchange Failed: ${errorMessage}` };
    }
}


// Fetches the WABA details using the debug_token endpoint
export async function getWabaDebugData(accessToken: string) {
    console.log('[ONBOARDING] Step 4: Fetching WABA details via debug_token endpoint.');
    try {
        const url = `https://graph.facebook.com/${API_VERSION}/debug_token`;

        const response = await axios.get(url, {
            params: {
                input_token: accessToken,
                access_token: `${process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID}|${process.env.META_ONBOARDING_APP_SECRET}`,
            },
        });

        const data = response.data?.data;
        console.log('[ONBOARDING] Step 4.1: Received debug_token data from Meta:', data);

        if (!data) {
            return { error: "Failed to fetch WABA debug data." };
        }

        return {
            business_id: data.business_id,
            wabas: data.waba_ids || [], // Ensure it's an array
            granted_scopes: data.granular_scopes?.map((s: any) => s.scope) || [],
        };
    } catch (e: any) {
        console.error("[ONBOARDING] getWabaDebugData() failed:", e);
        return { error: e.message || "Unknown error fetching debug token" };
    }
}



// Handles the creation or update of projects after successful WABA onboarding.
export async function handleWabaOnboarding(code: string) {
    console.log('[ONBOARDING] Step 1: Received onboarding callback with authorization code.');
    const session = await getSession();
    if (!session?.user) {
        console.error('[ONBOARDING] Error: Authentication required.');
        return { error: 'Authentication required' };
    }
    
    try {
        const tokenResult = await exchangeCodeForTokens(code);
        if (tokenResult.error || !tokenResult.accessToken) {
            throw new Error(tokenResult.error || 'Failed to get access token.');
        }
        
        const accessToken = tokenResult.accessToken;
        
        console.log('[ONBOARDING] Step 5: Getting WABA data from new access token.');
        const wabaData = await getWabaDebugData(accessToken);
        if (wabaData.error) {
             throw new Error(wabaData.error);
        }

        if (!wabaData.wabas || wabaData.wabas.length === 0) {
            console.error('[ONBOARDING] Error: No WABA IDs found for the provided token.', wabaData);
            return { error: 'No WhatsApp accounts were found for the provided token. Please ensure you selected them during the flow.' };
        }

        console.log('[ONBOARDING] Step 6: Onboarding data is valid. Preparing to save to database.');
        const { db } = await connectToDatabase();
        
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });
        if (!user) throw new Error("User not found.");

        let planIdToAssign: ObjectId;
        let creditsToAssign: number = user.credits || 0;

        if (user.planId) {
            planIdToAssign = user.planId;
            console.log(`[ONBOARDING] User has existing plan ID: ${planIdToAssign}`);
        } else {
            console.log('[ONBOARDING] User has no plan. Fetching default plan.');
            const defaultPlan = await db.collection<Plan>('plans').findOne({ isDefault: true });
            if (!defaultPlan) {
                const errorMsg = "[ONBOARDING] FATAL: No default plan is set for new users. Onboarding cannot proceed.";
                console.error(errorMsg);
                throw new Error("System configuration error: No default plan is set for new users.");
            }
            planIdToAssign = defaultPlan._id;
            creditsToAssign = defaultPlan.signupCredits || 0;
            console.log(`[ONBOARDING] Assigning default plan ID: ${planIdToAssign}`);
        }

        const hasCatalogManagement = wabaData.granted_scopes.includes('catalog_management');
        const bulkOps = [];
        console.log(`[ONBOARDING] Step 7: Preparing to create/update ${wabaData.wabas.length} project(s).`);

        // Because debug_token doesn't give names, we have to fetch them.
        for (const waba of wabaData.wabas) {
             const wabaDetailsResponse = await axios.get(`https://graph.facebook.com/${API_VERSION}/${waba.id}`, {
                params: { fields: 'name', access_token: accessToken }
            });
            const wabaName = wabaDetailsResponse.data.name || `WABA ${waba.id}`;
            
            const projectData = {
                userId: new ObjectId(session.user._id),
                name: wabaName,
                wabaId: waba.id,
                businessId: wabaData.business_id,
                appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID,
                accessToken: accessToken,
                messagesPerSecond: 80,
                hasCatalogManagement,
                phoneNumbers: [], // Will be synced later
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
            console.log('[ONBOARDING] Step 8: Executing database bulk write operation.');
            const result = await db.collection('projects').bulkWrite(bulkOps);
            console.log(`[ONBOARDING] Step 9: Database operation complete. Upserted IDs: ${Object.values(result.upsertedIds).length}, Modified: ${result.modifiedCount}`);
            
            // Post-creation/update tasks
             console.log('[ONBOARDING] Step 10: Post-creation setup for projects (webhook subscription & phone sync).');
            for (const op of bulkOps) {
                const updatedProject = await db.collection<Project>('projects').findOne(op.updateOne.filter);
                if(updatedProject) {
                    await handleSyncPhoneNumbers(updatedProject._id.toString());
                    await handleSubscribeProjectWebhook(updatedProject.wabaId!, updatedProject.appId!, updatedProject.accessToken);
                }
            }
        }

        revalidatePath('/dashboard');
        console.log('[ONBOARDING] Step 11: Onboarding complete! Success response sent.');
        return { success: true, message: `Onboarding complete! Your projects have been synced.` };

    } catch (e: any) {
        console.error("[ONBOARDING] Onboarding process failed:", e);
        return { error: getErrorMessage(e) };
    }
}
