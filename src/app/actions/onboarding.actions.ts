
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
    console.log('[ONBOARDING] Step 2: Starting token exchange.');
    const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const appSecret = process.env.META_ONBOARDING_APP_SECRET;

    if (!appId || !appSecret) {
        const errorMsg = '[ONBOARDING] FATAL: Server is not configured for Meta OAuth. Missing App ID or Secret.';
        console.error(errorMsg);
        return { error: 'Server is not configured for Meta OAuth. Missing App ID or Secret.' };
    }
    
    const redirectUri = 'https://sabnode.com/auth/facebook/callback';

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`, {
            params: {
                client_id: appId,
                client_secret: appSecret,
                code: code,
                redirect_uri: redirectUri,
            },
        });
        
        const accessToken = response.data.access_token;
        
        if (!accessToken) {
            const errorMsg = 'Could not retrieve access token from Meta. The code may be invalid or expired.';
            console.error('[ONBOARDING] Token exchange failed. Response from Meta:', response.data);
            throw new Error(errorMsg);
        }

        console.log('[ONBOARDING] Step 3: Token exchange successful.');
        return { accessToken };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error("[ONBOARDING] Token Exchange Error:", errorMessage);
        return { error: `Token Exchange Failed: ${errorMessage}` };
    }
}


// Fetches the WABA details using the debug_token endpoint
async function getWabaDebugData(accessToken: string): Promise<{ wabas: any[], phone_numbers: any[], business_id?: string, granted_scopes: string[], error?: string }> {
     console.log('[ONBOARDING] Step 4: Fetching WABA debug data.');
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/debug_token`, {
            params: {
                input_token: accessToken,
                access_token: `${process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID}|${process.env.META_ONBOARDING_APP_SECRET}`
            }
        });

        const data = response.data.data;
        if (!data || data.error) {
             throw new Error(data.error?.message || 'Invalid token data received from debug endpoint.');
        }

        const granularScopes = data.granular_scopes || [];
        const businessId = data.granular_scopes.find((s:any) => s.scope === 'whatsapp_business_management')?.target_ids[0];

        // This is a simplified reconstruction of what the embedded signup postMessage would have provided
        const debugData = {
            wabas: data.granular_scopes.filter((s:any) => s.scope === 'whatsapp_business_management').map((s:any) => ({ id: s.target_ids[0] })),
            phone_numbers: data.granular_scopes.filter((s:any) => s.scope === 'whatsapp_business_messaging').map((s:any) => ({ id: s.target_ids[0] })),
            business_id: businessId,
            granted_scopes: data.granular_scopes.map((s:any) => s.scope),
        };
        
        console.log('[ONBOARDING] Step 5: Successfully retrieved debug data.');
        return debugData;

    } catch (e) {
        const errorMessage = getErrorMessage(e);
        console.error("[ONBOARDING] WABA Debug Data Fetch Error:", errorMessage);
        return { error: `Could not fetch account details from token: ${errorMessage}`, wabas: [], phone_numbers: [], business_id: undefined, granted_scopes: [] };
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
        
        const wabaData = await getWabaDebugData(accessToken);
        if (wabaData.error) {
             throw new Error(wabaData.error);
        }

        if (!wabaData.wabas || wabaData.wabas.length === 0 || !wabaData.phone_numbers || wabaData.phone_numbers.length === 0) {
            console.error('[ONBOARDING] Error: No WABA or phone numbers found for the provided token.', wabaData);
            return { error: 'No WhatsApp accounts or phone numbers were found for the provided token. Please ensure you selected them during the flow.' };
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
