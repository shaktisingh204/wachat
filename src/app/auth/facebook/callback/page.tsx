
'use server';

import { redirect } from 'next/navigation';
import axios from 'axios';
import { exchangeCodeForTokens, handleWabaOnboarding } from '@/app/actions/onboarding.actions';

const API_VERSION = 'v23.0';

export default async function FacebookCallbackPage({ searchParams }: { searchParams: { code?: string, error?: string, error_reason?: string, error_description?: string, state?: string } }) {
    
    if (searchParams.error) {
        console.error(`Facebook Auth Error: ${searchParams.error_reason} - ${searchParams.error_description}`);
        redirect(`/dashboard/setup?error=${encodeURIComponent(searchParams.error_description || 'An unknown error occurred.')}`);
    }

    const code = searchParams.code;
    if (!code) {
        redirect('/dashboard/setup?error=Authorization_code_not_found');
    }
    
    // Step 1: Exchange code for an access token
    const tokenResult = await exchangeCodeForTokens(code);

    if (tokenResult.error || !tokenResult.accessToken) {
        redirect(`/dashboard/setup?error=${encodeURIComponent(tokenResult.error || 'Failed to retrieve access token.')}`);
    }

    const accessToken = tokenResult.accessToken;

    try {
        // Step 2: Get user's granted permissions and business assets
        const debugTokenResponse = await axios.get(`https://graph.facebook.com/debug_token`, {
            params: {
                input_token: accessToken,
                access_token: process.env.META_ONBOARDING_APP_ID + '|' + process.env.META_ONBOARDING_APP_SECRET
            }
        });
        
        const grantedScopes = debugTokenResponse.data.data.scopes || [];

        // Step 3: Fetch the WhatsApp Business Accounts (WABAs)
        const wabasResponse = await axios.get(`https://graph.facebook.com/${API_VERSION}/me/whatsapp_business_accounts`, {
            params: {
                fields: 'id,name',
                access_token: accessToken,
            }
        });
        
        const wabas = wabasResponse.data.data;
        if (!wabas || wabas.length === 0) {
            throw new Error('No WhatsApp Business Accounts found for this user.');
        }

        // Step 4: For each WABA, get its phone numbers
        const phoneNumbersPromises = wabas.map((waba: any) => 
            axios.get(`https://graph.facebook.com/${API_VERSION}/${waba.id}/phone_numbers`, {
                params: {
                    fields: 'id,display_phone_number,verified_name',
                    access_token: accessToken,
                }
            }).then(res => res.data.data.map((p: any) => ({ ...p, waba_id: waba.id }))) // Add waba_id to each phone number
        );

        const phoneNumbersArrays = await Promise.all(phoneNumbersPromises);
        const allPhoneNumbers = phoneNumbersArrays.flat();
        
        let businessId;
        try {
            const businessesResponse = await axios.get(`https://graph.facebook.com/v23.0/me/businesses`, {
                params: { access_token: accessToken }
            });
            businessId = businessesResponse.data.data?.[0]?.id;
        } catch (e) {
            console.warn("Could not retrieve business ID for this user.");
        }
        
        // Step 5: Save everything to the database
        const onboardingResult = await handleWabaOnboarding({
            wabas,
            phone_numbers: allPhoneNumbers,
            business_id: businessId,
            access_token: accessToken,
            granted_scopes: grantedScopes
        });
        
        if (onboardingResult.error) {
            throw new Error(onboardingResult.error);
        }

        redirect('/dashboard');

    } catch (error: any) {
        console.error("Facebook callback processing error:", error.response?.data || error.message);
        const errorMessage = error.response?.data?.error?.message || error.message || 'An unknown error occurred during setup.';
        redirect(`/dashboard/setup?error=${encodeURIComponent(errorMessage)}`);
    }
}
