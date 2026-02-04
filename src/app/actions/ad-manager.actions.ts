

'use server';

import { revalidatePath } from 'next/cache';
import axios from 'axios';
import { ObjectId, type WithId } from 'mongodb';

import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index';
import type { AdCampaign, Project, CustomAudience, User, FacebookPage } from '@/lib/definitions';

const API_VERSION = 'v23.0';
const LOG_PREFIX = '[AD_MANAGER]'; // Define a prefix for logs

export async function getAdAccounts(): Promise<{ accounts: any[], error?: string }> {
    console.log(`${LOG_PREFIX} getAdAccounts called.`);
    const session = await getSession();
    if (!session?.user) {
        console.error(`${LOG_PREFIX} getAdAccounts: Authentication required.`);
        return { accounts: [], error: 'Authentication required.' };
    }

    const adAccounts = session.user.metaAdAccounts || [];
    console.log(`${LOG_PREFIX} getAdAccounts: Found ${adAccounts.length} ad accounts for user ${session.user._id}.`);
    return { accounts: adAccounts };
}


export async function getAdCampaigns(adAccountId: string): Promise<{ campaigns?: WithId<AdCampaign>[], error?: string }> {
    console.log(`${LOG_PREFIX} getAdCampaigns called for ad account: ${adAccountId}.`);
    const session = await getSession();
    if (!session?.user?.adManagerAccessToken) {
        console.error(`${LOG_PREFIX} getAdCampaigns: Ad Manager account not connected.`);
        return { campaigns: [], error: 'Ad Manager account not connected.' };
    }

    if (!adAccountId) {
        console.log(`${LOG_PREFIX} getAdCampaigns: No ad account ID provided.`);
        return { campaigns: [] };
    }

    try {
        const { db } = await connectToDatabase();
        const localCampaigns = await db.collection<AdCampaign>('ad_campaigns')
            .find({ adAccountId: adAccountId, userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();

        console.log(`${LOG_PREFIX} getAdCampaigns: Found ${localCampaigns.length} local campaigns.`);

        if (localCampaigns.length === 0) {
            return { campaigns: [] };
        }

        const adIds = localCampaigns.map(c => c.metaAdId);
        console.log(`${LOG_PREFIX} getAdCampaigns: Fetching insights for Meta Ad IDs:`, adIds.join(','));

        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}`, {
            params: {
                ids: adIds.join(','),
                fields: 'status,insights{impressions, clicks, spend, ctr}',
                access_token: session.user.adManagerAccessToken
            }
        });

        if (response.data.error) {
            console.error(`${LOG_PREFIX} getAdCampaigns: Graph API error`, response.data.error);
            throw new Error(getErrorMessage({ response }));
        }

        const metaData = response.data;
        console.log(`${LOG_PREFIX} getAdCampaigns: Successfully fetched insights from Meta.`);

        const combinedData = localCampaigns.map(campaign => {
            const metaAd = metaData[campaign.metaAdId];
            return metaAd ? { ...campaign, status: metaAd.status || campaign.status, insights: metaAd.insights?.data?.[0] || {} } : campaign;
        });

        return { campaigns: JSON.parse(JSON.stringify(combinedData)) };
    } catch (e) {
        console.error(`${LOG_PREFIX} Failed to fetch ad campaigns with insights:`, getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

export async function getFacebookPagesForAdCreation(): Promise<{ pages?: FacebookPage[], error?: string }> {
    console.log(`${LOG_PREFIX} getFacebookPagesForAdCreation called.`);
    const session = await getSession();
    if (!session?.user?.metaSuiteAccessToken) {
        console.error(`${LOG_PREFIX} getFacebookPagesForAdCreation: Facebook account not connected.`);
        return { error: 'Facebook account not connected.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/me/accounts`, {
            params: {
                fields: 'id,name',
                access_token: session.user.metaSuiteAccessToken,
            }
        });
        if (response.data.error) {
            console.error(`${LOG_PREFIX} getFacebookPagesForAdCreation: Graph API error`, response.data.error);
            throw new Error(getErrorMessage({ response }));
        }
        console.log(`${LOG_PREFIX} getFacebookPagesForAdCreation: Found ${response.data.data?.length || 0} pages.`);
        return { pages: response.data.data || [] };
    } catch (e: any) {
        console.error(`${LOG_PREFIX} Failed to get Facebook pages for ad creation:`, getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}


export async function handleCreateAdCampaign(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    console.log(`${LOG_PREFIX} handleCreateAdCampaign started.`);
    const session = await getSession();
    if (!session?.user?.adManagerAccessToken) {
        console.error(`${LOG_PREFIX} handleCreateAdCampaign: Authentication required.`);
        return { error: 'Ad Manager account not connected.' };
    }

    const adAccountIdRaw = formData.get('adAccountId') as string;
    const adAccountId = adAccountIdRaw.startsWith('act_') ? adAccountIdRaw : `act_${adAccountIdRaw}`;
    const facebookPageId = formData.get('facebookPageId') as string;
    const campaignName = formData.get('campaignName') as string;
    const dailyBudget = Number(formData.get('dailyBudget')) * 100;
    const adMessage = formData.get('adMessage') as string;
    const destinationUrl = formData.get('destinationUrl') as string;

    if (!adAccountId || !facebookPageId || !campaignName || isNaN(dailyBudget) || !adMessage || !destinationUrl) {
        console.error(`${LOG_PREFIX} handleCreateAdCampaign: Missing required fields.`);
        return { error: 'All fields are required.' };
    }

    console.log(`${LOG_PREFIX} handleCreateAdCampaign: Data validated.`, { adAccountId, facebookPageId, campaignName });
    const { db } = await connectToDatabase();

    try {
        // Step 1: Create Campaign
        console.log(`${LOG_PREFIX} handleCreateAdCampaign: Step 1 - Creating campaign...`);
        const campaignResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${adAccountId}/campaigns`, {
            name: campaignName, objective: 'LINK_CLICKS', status: 'PAUSED', special_ad_categories: [], access_token: session.user.adManagerAccessToken,
        });
        const campaignId = campaignResponse.data.id;
        if (!campaignId) {
            console.error(`${LOG_PREFIX} handleCreateAdCampaign: Failed to create campaign.`, campaignResponse.data);
            throw new Error('Failed to create campaign.');
        }
        console.log(`${LOG_PREFIX} handleCreateAdCampaign: Campaign created with ID: ${campaignId}`);

        // Step 2: Create Ad Set
        console.log(`${LOG_PREFIX} handleCreateAdCampaign: Step 2 - Creating ad set...`);
        const adSetResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${adAccountId}/adsets`, {
            name: `${campaignName} Ad Set`, campaign_id: campaignId, daily_budget: dailyBudget, billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS',
            targeting: { geo_locations: { countries: ['IN'] }, age_min: 18 }, status: 'PAUSED', access_token: session.user.adManagerAccessToken,
        });
        const adSetId = adSetResponse.data.id;
        if (!adSetId) {
            console.error(`${LOG_PREFIX} handleCreateAdCampaign: Failed to create ad set.`, adSetResponse.data);
            throw new Error('Failed to create ad set.');
        }
        console.log(`${LOG_PREFIX} handleCreateAdCampaign: Ad set created with ID: ${adSetId}`);

        // Step 3: Create Ad Creative
        console.log(`${LOG_PREFIX} handleCreateAdCampaign: Step 3 - Creating ad creative...`);
        const creativeResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${adAccountId}/adcreatives`, {
            name: `${campaignName} Ad Creative`,
            object_story_spec: {
                page_id: facebookPageId,
                link_data: { message: adMessage, link: destinationUrl, image_url: 'https://placehold.co/1200x628.png', call_to_action: { type: 'LEARN_MORE' } },
            },
            access_token: session.user.adManagerAccessToken,
        });
        const creativeId = creativeResponse.data.id;
        if (!creativeId) {
            console.error(`${LOG_PREFIX} handleCreateAdCampaign: Failed to create ad creative.`, creativeResponse.data);
            throw new Error('Failed to create ad creative.');
        }
        console.log(`${LOG_PREFIX} handleCreateAdCampaign: Ad creative created with ID: ${creativeId}`);


        // Step 4: Create Ad
        console.log(`${LOG_PREFIX} handleCreateAdCampaign: Step 4 - Creating ad...`);
        const adResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${adAccountId}/ads`, {
            name: `${campaignName} Ad`, adset_id: adSetId, creative: { creative_id: creativeId }, status: 'PAUSED', access_token: session.user.adManagerAccessToken,
        });
        const adId = adResponse.data.id;
        if (!adId) {
            console.error(`${LOG_PREFIX} handleCreateAdCampaign: Failed to create ad.`, adResponse.data);
            throw new Error('Failed to create ad.');
        }
        console.log(`${LOG_PREFIX} handleCreateAdCampaign: Ad created with ID: ${adId}`);

        const newAdCampaign: Omit<AdCampaign, '_id'> = {
            userId: new ObjectId(session.user._id),
            adAccountId: adAccountId,
            name: campaignName,
            status: 'PAUSED',
            dailyBudget: dailyBudget / 100,
            metaCampaignId: campaignId,
            metaAdSetId: adSetId,
            metaAdCreativeId: creativeId,
            metaAdId: adId,
            createdAt: new Date(),
        };
        await db.collection('ad_campaigns').insertOne(newAdCampaign as any);
        console.log(`${LOG_PREFIX} handleCreateAdCampaign: Saved campaign to local DB.`);

        revalidatePath('/dashboard/ad-manager/campaigns');
        return { message: `Ad campaign "${campaignName}" created successfully! It is currently paused.` };

    } catch (e: any) {
        console.error(`${LOG_PREFIX} handleCreateAdCampaign: FATAL error during creation process.`, getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

export async function getCustomAudiences(adAccountId: string): Promise<{ audiences?: CustomAudience[], error?: string }> {
    console.log(`${LOG_PREFIX} getCustomAudiences called for ad account: ${adAccountId}.`);
    const session = await getSession();
    if (!session?.user?.adManagerAccessToken) {
        console.error(`${LOG_PREFIX} getCustomAudiences: Ad Manager account not connected.`);
        return { error: 'Ad Manager account not connected.' };
    }

    if (!adAccountId) {
        console.log(`${LOG_PREFIX} getCustomAudiences: No ad account ID provided.`);
        return { audiences: [] };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${adAccountId}/customaudiences`, {
            params: {
                fields: 'id,name,description,approximate_count_lower_bound,delivery_status,operation_status,time_updated',
                access_token: session.user.adManagerAccessToken,
            }
        });

        if (response.data.error) {
            console.error(`${LOG_PREFIX} getCustomAudiences: Graph API error`, response.data.error);
            throw new Error(getErrorMessage({ response }));
        }

        console.log(`${LOG_PREFIX} getCustomAudiences: Found ${response.data.data?.length || 0} custom audiences.`);
        return { audiences: response.data.data || [] };

    } catch (e: any) {
        console.error(`${LOG_PREFIX} Failed to fetch custom audiences:`, getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

export async function deleteAdAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`${LOG_PREFIX} deleteAdAccount called for account: ${accountId}`);
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { metaAdAccounts: { id: accountId } } } as any
        );

        console.log(`${LOG_PREFIX} Successfully removed ad account ${accountId} from user.`);
        revalidatePath('/dashboard/ad-manager/ad-accounts');
        return { success: true };
    } catch (e: any) {
        console.error(`${LOG_PREFIX} Failed to delete ad account:`, e);
        return { success: false, error: 'Failed to disconnect ad account.' };
    }
}

// --- Hierarchy Management ---

export async function getAdSets(campaignId: string): Promise<{ adSets?: any[], error?: string }> {
    console.log(`${LOG_PREFIX} getAdSets called for campaign: ${campaignId}`);
    const session = await getSession();
    if (!session?.user?.adManagerAccessToken) {
        return { error: 'Authentication required' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${campaignId}/adsets`, {
            params: {
                fields: 'id,name,status,daily_budget,billing_event,optimization_goal,insights{impressions,clicks,spend,ctr}',
                access_token: session.user.adManagerAccessToken
            }
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        const adSets = response.data.data.map((adSet: any) => ({
            ...adSet,
            insights: adSet.insights?.data?.[0] || {}
        }));

        return { adSets };
    } catch (e: any) {
        console.error(`${LOG_PREFIX} Failed to get ad sets:`, getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

export async function getAds(adSetId: string): Promise<{ ads?: any[], error?: string }> {
    console.log(`${LOG_PREFIX} getAds called for ad set: ${adSetId}`);
    const session = await getSession();
    if (!session?.user?.adManagerAccessToken) {
        return { error: 'Authentication required' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${adSetId}/ads`, {
            params: {
                fields: 'id,name,status,creative{image_url,thumbnail_url,object_story_spec},insights{impressions,clicks,spend,ctr}',
                access_token: session.user.adManagerAccessToken
            }
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));

        const ads = response.data.data.map((ad: any) => ({
            ...ad,
            insights: ad.insights?.data?.[0] || {},
            imageUrl: ad.creative?.image_url || ad.creative?.thumbnail_url || ad.creative?.object_story_spec?.link_data?.image_url
        }));

        return { ads };
    } catch (e: any) {
        console.error(`${LOG_PREFIX} Failed to get ads:`, getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

export async function updateEntityStatus(id: string, type: 'campaign' | 'adset' | 'ad', status: 'ACTIVE' | 'PAUSED'): Promise<{ success: boolean; error?: string }> {
    console.log(`${LOG_PREFIX} updateEntityStatus: ${type} ${id} -> ${status}`);
    const session = await getSession();
    if (!session?.user?.adManagerAccessToken) {
        return { success: false, error: 'Authentication required' };
    }

    try {
        // Optimistic update logic usually happens on client, but here we push to FB
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${id}`, {
            status: status,
            access_token: session.user.adManagerAccessToken
        });

        if (response.data.success) {
            // Also update local DB for Campaigns if applicable
            if (type === 'campaign') {
                const { db } = await connectToDatabase();
                await db.collection('ad_campaigns').updateOne(
                    { metaCampaignId: id },
                    { $set: { status: status } }
                );
            }

            // Revalidate all relevant paths
            revalidatePath('/dashboard/ad-manager/campaigns');

            return { success: true };
        } else {
            throw new Error('Graph API returned unsuccessful response');
        }

    } catch (e: any) {
        console.error(`${LOG_PREFIX} Failed to update status:`, getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Creation Helper ---

export async function uploadAdImage(formData: FormData): Promise<{ imageHash?: string; imageUrl?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user?.adManagerAccessToken || !session?.user?.activeAdAccountAccountId) {
        return { error: 'Authentication or Ad Account required' };
    }

    const file = formData.get('file') as File;
    if (!file) return { error: 'No file provided' };

    console.log(`${LOG_PREFIX} Uploading ad image: ${file.name}`);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // This usually requires a different content type or specific formData structure for FB Graph API
        const form = new FormData();
        // We have to use 'fs' streams usually for standard node-fetch, but typically we can pass blob/buffer if supported
        // However, axios + FormData in Node environment is tricky.
        // Simplified approach: encoding as bytes and sending if possible, or using a library that handles multipart/form-data well in Node.
        // For simplicity in this environment, let's assume standard FormData works or we mock the actual upload interaction if libraries are missing.

        // Correct approach for Node.js file upload to FB Graph API:
        const url = `https://graph.facebook.com/${API_VERSION}/${session.user.activeAdAccountAccountId}/adimages`;
        const uploadData = new FormData();
        uploadData.append('filename', new Blob([buffer as any]), file.name);
        uploadData.append('access_token', session.user.adManagerAccessToken);

        const response = await fetch(url, {
            method: 'POST',
            body: uploadData,
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        // FB returns { images: { "filename": { hash: "...", url: "..." } } }
        const imageInfo = Object.values(data.images)[0] as any;
        return { imageHash: imageInfo.hash, imageUrl: imageInfo.url };

    } catch (e: any) {
        console.error(`${LOG_PREFIX} Failed to upload image:`, e.message);
        return { error: e.message || 'Failed to upload image' };
    }
}
