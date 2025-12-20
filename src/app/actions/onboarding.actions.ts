
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
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/facebook/callback`;

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

        const response = await axios.post(url, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

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

// Fetches the Business ID and then the WABA details using the access token.
export async function getWabaDetails(accessToken: string) {
    console.log('[ONBOARDING] Step 4: Fetching Business and WABA details.');
    try {
        // Step 1: Get the user's associated business accounts
        const businessResponse = await axios.get(`https://graph.facebook.com/${API_VERSION}/me/businesses`, {
            params: { access_token: accessToken }
        });
        console.log('[ONBOARDING] Step 4.1: Received business data:', businessResponse.data);

        const businesses = businessResponse.data.data;
        if (!businesses || businesses.length === 0) {
            return { error: "No Meta Business Account found for this user." };
        }
        // Use the first business account found
        const businessId = businesses[0].id;

        // Step 2: Use the Business ID to get owned WABAs
        const wabaResponse = await axios.get(`https://graph.facebook.com/${API_VERSION}/${businessId}/owned_whatsapp_business_accounts`, {
            params: {
                fields: 'name,id',
                access_token: accessToken,
            }
        });
        console.log('[ONBOARDING] Step 4.2: Received WABA data:', wabaResponse.data);
        
        const wabas = wabaResponse.data.data;
        if (!wabas || wabas.length === 0) {
             return { error: "No WhatsApp Business Accounts found in the connected Meta Business Account." };
        }

        return {
            business_id: businessId,
            wabas: wabas.map((w: any) => ({ id: w.id, name: w.name })),
        };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error("[ONBOARDING] getWabaDetails() failed:", errorMessage, e.response?.data || '');
        return { error: `Failed to retrieve account details from Meta: ${errorMessage}` };
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
        const wabaData = await getWabaDetails(accessToken);
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

        const bulkOps = [];
        console.log(`[ONBOARDING] Step 7: Preparing to create/update ${wabaData.wabas.length} project(s).`);

        for (const waba of wabaData.wabas) {
            const projectData = {
                userId: new ObjectId(session.user._id),
                name: waba.name || `WABA ${waba.id}`,
                wabaId: waba.id,
                businessId: wabaData.business_id,
                appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID,
                accessToken: accessToken,
                messagesPerSecond: 80,
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
