'use server';

import { revalidatePath } from 'next/cache';
import { type WithId } from 'mongodb';

import { rustClient, RustApiError } from '@/lib/rust-client';
import { getProjectById } from '@/app/actions/project.actions';
import { getErrorMessage } from '@/lib/utils';
import { _createProjectFromWaba } from './whatsapp.actions';
import type {
    Project,
    FacebookPage,
    FacebookPost,
    FacebookPageDetails,
    PageInsights,
    FacebookConversation,
    FacebookMessage,
    RandomizerPost,
    FacebookBroadcast,
    FacebookLiveStream,
    FacebookSubscriber,
    FacebookOrder,
    FacebookEvent,
    FacebookLeadGenForm,
    FacebookLead,
} from '@/lib/definitions';
import { getInstagramAccountForPage as _getInstagramAccountForPage } from './instagram.actions';

// ---------------------------------------------------------------------------
// Helpers — wrap RustApiError so we keep the legacy { error?, success?, data? }
// envelope shape that the call sites expect.
// ---------------------------------------------------------------------------

function rustErr<T extends { error?: string }>(e: unknown, extra?: Partial<T>): T {
    if (e instanceof RustApiError) {
        return ({ ...(extra || {}), error: e.message } as unknown) as T;
    }
    if (e instanceof Error) {
        return ({ ...(extra || {}), error: e.message } as unknown) as T;
    }
    return ({ ...(extra || {}), error: 'Unknown error' } as unknown) as T;
}

// =================================================================
//  PAGES (cluster: wachatFacebookPages)
// =================================================================

export async function handleFacebookPageSetup(data: {
    projectId: string;
    facebookPageId: string;
    accessToken: string;
}): Promise<{ success?: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.handleFacebookPageSetup(data);
        if (res.error) return { error: res.error };
        revalidatePath('/dashboard/facebook');
        revalidatePath('/dashboard/facebook/settings');
        revalidatePath('/dashboard/facebook/all-projects');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function handleFacebookOAuthCallback(
    code: string,
    state: string,
): Promise<{ success: boolean; error?: string; redirectPath?: string }> {
    // Pull the userId / state cookie / includeCatalog flag in TS so the Rust
    // handler stays stateless.
    const { getSession } = await import('./user.actions');
    const { cookies } = await import('next/headers');

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const cookieStore = await cookies();
    const stateCookie = cookieStore.get('onboarding_state')?.value;
    if (!stateCookie) {
        return { success: false, error: 'Onboarding session expired or cookies are disabled. Please try again.' };
    }

    let parsed: { state?: string; userId?: string; includeCatalog?: boolean };
    try {
        parsed = JSON.parse(stateCookie);
    } catch {
        return { success: false, error: 'Onboarding session is corrupted. Please try again.' };
    }

    cookieStore.delete('onboarding_state');

    // Live WhatsApp onboarding runs through the Embedded-Signup app
    // (`NEXT_PUBLIC_META_ONBOARDING_APP_ID`), not the Meta-Suite app the
    // Rust BFF is configured with — and the Rust `whatsapp` arm is still a
    // stub that returns "not implemented". Handle the whole branch here.
    if (state === 'whatsapp') {
        return handleWhatsAppOnboardingCallback(
            code,
            session.user._id.toString(),
            parsed.includeCatalog === true,
        );
    }

    try {
        const res = await rustClient.wachatFacebookPages.handleFacebookOAuthCallback({
            code,
            state,
            userId: session.user._id.toString(),
            stateCookie,
            includeCatalog: parsed.includeCatalog === true,
        });
        if (res.error) return { success: false, error: res.error };
        if (res.redirectPath) {
            revalidatePath(res.redirectPath);
        }
        revalidatePath('/wachat');
        revalidatePath('/dashboard/facebook/all-projects');
        revalidatePath('/dashboard/instagram/connections');
        revalidatePath('/dashboard/ad-manager/ad-accounts');
        return { success: !!res.success, redirectPath: res.redirectPath };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

const META_GRAPH_BASE = 'https://graph.facebook.com/v24.0';

async function metaGraphGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${META_GRAPH_BASE}/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const res = await fetch(url, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(json?.error?.message || `Meta API request failed (${res.status})`);
    }
    return json as T;
}

/**
 * WhatsApp branch of the OAuth callback (legacy flow restored): exchange the
 * code for a long-lived token with the onboarding app, discover the user's
 * WABAs via `me/businesses`, and create a WaChat project per WABA (which
 * also syncs + registers its phone numbers).
 */
async function handleWhatsAppOnboardingCallback(
    code: string,
    userId: string,
    includeCatalog: boolean,
): Promise<{ success: boolean; error?: string; redirectPath?: string }> {
    const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const appSecret = process.env.META_ONBOARDING_APP_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    console.log(`[WhatsApp OAuth] Handling onboarding callback for user ${userId} (includeCatalog=${includeCatalog})`);

    if (!appUrl) {
        console.error('[WhatsApp OAuth] NEXT_PUBLIC_APP_URL is not set.');
        return { success: false, error: 'Server is not configured for authentication. NEXT_PUBLIC_APP_URL is not set.' };
    }
    if (!appId || !appSecret) {
        console.error(`[WhatsApp OAuth] Missing onboarding app credentials (appId set: ${!!appId}, secret set: ${!!appSecret}).`);
        return { success: false, error: 'Server is not configured for whatsapp authentication. Please ensure credentials are set in your environment variables.' };
    }

    try {
        const redirectUri = new URL('/auth/facebook/callback', appUrl).toString();

        const shortLived = await metaGraphGet<{ access_token?: string }>('oauth/access_token', {
            client_id: appId,
            redirect_uri: redirectUri,
            client_secret: appSecret,
            code,
        });
        if (!shortLived.access_token) {
            console.error('[WhatsApp OAuth] Code exchange returned no access token.');
            return { success: false, error: 'Failed to obtain access token from Facebook.' };
        }

        const longLived = await metaGraphGet<{ access_token?: string }>('oauth/access_token', {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortLived.access_token,
        });
        const accessToken = longLived.access_token;
        if (!accessToken) {
            console.error('[WhatsApp OAuth] Long-lived token exchange returned no access token.');
            return { success: false, error: 'Could not obtain a long-lived token from Facebook.' };
        }

        // Mirror the Rust handler: keep the user-level long-lived token on
        // the user document so sync cycles can reuse it.
        try {
            const { connectToDatabase } = await import('@/lib/mongodb');
            const { ObjectId } = await import('mongodb');
            const { db } = await connectToDatabase();
            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $set: { metaSuiteAccessToken: accessToken } },
            );
        } catch (e) {
            console.warn(`[WhatsApp OAuth] Could not persist user token: ${getErrorMessage(e)}`);
        }

        const wabaIds: string[] = [];
        const seen = new Set<string>();
        const addWaba = (id: string | undefined) => {
            if (id && !seen.has(id)) {
                seen.add(id);
                wabaIds.push(id);
            }
        };

        // Primary discovery: Embedded-Signup tokens only carry the
        // permissions from the Meta configuration (no business_management),
        // so the WABAs the user selected live in the token's granular
        // scopes, not behind me/businesses.
        let grantedScopes: string[] = [];
        let businessIdsFromToken: string[] = [];
        try {
            const debug = await metaGraphGet<{
                data?: {
                    scopes?: string[];
                    granular_scopes?: { scope: string; target_ids?: string[] }[];
                };
            }>('debug_token', {
                input_token: accessToken,
                access_token: `${appId}|${appSecret}`,
            });
            const granular = debug.data?.granular_scopes ?? [];
            grantedScopes = debug.data?.scopes ?? granular.map((s) => s.scope);
            console.log(`[WhatsApp OAuth] Token scopes: ${JSON.stringify(grantedScopes)}`);
            console.log(`[WhatsApp OAuth] Token granular scopes: ${JSON.stringify(granular)}`);
            for (const s of granular) {
                if (s.scope === 'whatsapp_business_management' || s.scope === 'whatsapp_business_messaging') {
                    for (const id of s.target_ids ?? []) addWaba(id);
                }
            }
            businessIdsFromToken = granular
                .filter((s) => s.scope === 'business_management')
                .flatMap((s) => s.target_ids ?? []);
            if (wabaIds.length > 0) {
                console.log(`[WhatsApp OAuth] Found ${wabaIds.length} WABA(s) via token granular scopes.`);
            }
        } catch (e) {
            console.error(`[WhatsApp OAuth] debug_token introspection failed: ${getErrorMessage(e)}`);
        }

        // Fallback: enumerate businesses and their WABA edges. Business ids
        // can come from the token's business_management granular scope (works
        // without the me/businesses call) or from me/businesses for classic
        // OAuth tokens.
        if (wabaIds.length === 0) {
            const businessIds = new Set<string>(businessIdsFromToken);
            try {
                const businesses = await metaGraphGet<{ data?: { id: string; name?: string }[] }>(
                    'me/businesses',
                    { access_token: accessToken },
                );
                for (const business of businesses.data ?? []) {
                    if (business.id) businessIds.add(business.id);
                }
            } catch (e) {
                console.warn(`[WhatsApp OAuth] me/businesses discovery failed: ${getErrorMessage(e)}`);
            }
            console.log(`[WhatsApp OAuth] Fallback: checking WABA edges of ${businessIds.size} business(es)...`);
            for (const businessId of businessIds) {
                // Owned covers WABAs created via Embedded Signup; client
                // covers WABAs shared with the business by a partner.
                for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts'] as const) {
                    try {
                        const wabas = await metaGraphGet<{ data?: { id: string }[] }>(
                            `${businessId}/${edge}`,
                            { access_token: accessToken },
                        );
                        for (const waba of wabas.data ?? []) addWaba(waba.id);
                    } catch (e) {
                        console.warn(`[WhatsApp OAuth] Could not fetch ${edge} for business ${businessId}: ${getErrorMessage(e)}`);
                    }
                }
            }
        }

        if (wabaIds.length === 0) {
            const hasWhatsAppScope = grantedScopes.includes('whatsapp_business_management')
                || grantedScopes.includes('whatsapp_business_messaging');
            const error = hasWhatsAppScope
                ? 'Facebook login completed, but no WhatsApp Business Account was shared with SabNode. Please click Connect again and, inside the Facebook popup, create or select a WhatsApp Business Account and finish every step of the signup.'
                : `Facebook login completed without WhatsApp permissions (granted: ${grantedScopes.join(', ') || 'none'}). The Meta app's Embedded Signup configuration (NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID) must be a WhatsApp Embedded Signup configuration that requests whatsapp_business_management and whatsapp_business_messaging.`;
            console.error(`[WhatsApp OAuth] ${error}`);
            return { success: false, error };
        }
        console.log(`[WhatsApp OAuth] Creating projects for ${wabaIds.length} WABA(s): ${wabaIds.join(', ')}`);

        const failures: string[] = [];
        for (const wabaId of wabaIds) {
            const result = await _createProjectFromWaba({ wabaId, appId, accessToken, includeCatalog, userId });
            if (result.error) {
                console.warn(`[WhatsApp OAuth] Failed to create project for WABA ${wabaId}: ${result.error}`);
                failures.push(result.error);
            }
        }
        if (failures.length === wabaIds.length) {
            console.error(`[WhatsApp OAuth] All ${wabaIds.length} project creations failed. First error: ${failures[0]}`);
            return { success: false, error: `Could not create a project for any connected WhatsApp Business Account. ${failures[0]}` };
        }

        console.log(`[WhatsApp OAuth] Onboarding complete: ${wabaIds.length - failures.length}/${wabaIds.length} project(s) created.`);
        revalidatePath('/wachat');
        return { success: true, redirectPath: '/wachat' };
    } catch (e) {
        console.error(`[WhatsApp OAuth] Unhandled error: ${getErrorMessage(e)}`);
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function handleManualFacebookPageSetup(
    prevState: { success?: boolean; error?: string },
    formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
    const projectName = formData.get('projectName') as string;
    const facebookPageId = formData.get('facebookPageId') as string;
    const accessToken = formData.get('accessToken') as string;

    if (!projectName || !facebookPageId || !accessToken) {
        return { error: 'All fields are required for manual setup.' };
    }

    try {
        const res = await rustClient.wachatFacebookPages.handleManualFacebookPageSetup({
            projectName,
            facebookPageId,
            accessToken,
        });
        if (res.error) return { error: res.error };
        revalidatePath('/dashboard/facebook/all-projects');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getFacebookPages(): Promise<{ pages?: FacebookPage[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getFacebookPages();
        if (res.error) return { error: res.error };
        return { pages: (res.pages || []) as FacebookPage[] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPageDetails(projectId: string): Promise<{ page?: FacebookPageDetails; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getPageDetails(projectId);
        if (res.error) return { error: res.error };
        return { page: res.page as FacebookPageDetails };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function handleUpdatePageDetails(
    prevState: { success: boolean; error?: string },
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const pageId = formData.get('pageId') as string;

    if (!projectId || !pageId) {
        return { success: false, error: 'Missing required IDs.' };
    }

    const body: { projectId: string; pageId: string; about?: string; phone?: string; website?: string } = {
        projectId,
        pageId,
    };
    const about = formData.get('about');
    const phone = formData.get('phone');
    const website = formData.get('website');
    if (about !== null) body.about = about as string;
    if (phone !== null) body.phone = phone as string;
    if (website !== null) body.website = website as string;

    try {
        const res = await rustClient.wachatFacebookPages.handleUpdatePageDetails(projectId, body);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getPageInsights(projectId: string): Promise<{ insights?: PageInsights; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getPageInsights(projectId);
        if (res.error) return { error: res.error };
        return { insights: res.insights };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getDetailedPageInsights(
    projectId: string,
    opts?: { metrics?: string; period?: 'day' | 'week' | 'days_28' | 'month' | 'lifetime'; since?: string; until?: string },
): Promise<{ insights?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getDetailedPageInsights(projectId, opts);
        if (res.error) return { error: res.error };
        return { insights: res.insights || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPageFanDemographics(projectId: string): Promise<{ demographics?: any; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getPageFanDemographics(projectId);
        if (res.error) return { error: res.error };
        return { demographics: res.demographics };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPageSettings(projectId: string): Promise<{ settings?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getPageSettings(projectId);
        if (res.error) return { error: res.error };
        return { settings: res.settings || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPageLocations(projectId: string): Promise<{ locations?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getPageLocations(projectId);
        if (res.error) return { error: res.error };
        return { locations: res.locations || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPageTabs(projectId: string): Promise<{ tabs?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getPageTabs(projectId);
        if (res.error) return { error: res.error };
        return { tabs: res.tabs || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPageCallToAction(projectId: string): Promise<{ cta?: any; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getPageCallToAction(projectId);
        if (res.error) return { error: res.error };
        return { cta: res.cta };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function setPageCallToAction(
    projectId: string,
    type:
        | 'BOOK_NOW'
        | 'CALL_NOW'
        | 'CONTACT_US'
        | 'GET_QUOTE'
        | 'MESSAGE_PAGE'
        | 'ORDER_FOOD'
        | 'SHOP_NOW'
        | 'SIGN_UP'
        | 'WATCH_VIDEO'
        | 'SEND_EMAIL'
        | 'LEARN_MORE',
    webUrl?: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.setPageCallToAction(projectId, { type, webUrl });
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getPageRoles(projectId: string): Promise<{ roles?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getPageRoles(projectId);
        if (res.error) return { error: res.error };
        return { roles: res.roles || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function debugAccessToken(projectId: string): Promise<{ tokenInfo?: any; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.debugAccessToken(projectId);
        if (res.error) return { error: res.error };
        return { tokenInfo: res.tokenInfo };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function refreshLongLivedToken(
    projectId: string,
): Promise<{ success: boolean; newExpiry?: number; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.refreshLongLivedToken(projectId);
        if (res.error) return { success: false, error: res.error };
        return { success: !!res.success, newExpiry: res.newExpiry };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getPageLiveVideos(projectId: string): Promise<{ liveVideos?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getPageLiveVideos(projectId);
        if (res.error) return { error: res.error };
        return { liveVideos: res.liveVideos || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function createLiveVideo(
    projectId: string,
    title: string,
    description?: string,
): Promise<{ liveVideo?: any; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.createLiveVideo(projectId, { title, description });
        if (res.error) return { error: res.error };
        return { liveVideo: res.liveVideo };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function endLiveVideo(
    liveVideoId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.endLiveVideo(projectId, liveVideoId);
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getLiveVideoComments(
    liveVideoId: string,
    projectId: string,
): Promise<{ comments?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookPages.getLiveVideoComments(projectId, liveVideoId);
        if (res.error) return { error: res.error };
        return { comments: res.comments || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

// =================================================================
//  CONTENT (cluster: wachatFacebookContent)
// =================================================================

export async function getFacebookPosts(
    projectId: string,
): Promise<{ posts?: FacebookPost[]; totalCount?: number; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getFacebookPosts(projectId);
        return { posts: (res.posts || []) as FacebookPost[], totalCount: res.totalCount ?? 0 };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message, posts: [], totalCount: 0 };
        throw e;
    }
}

export async function handleCreateFacebookPost(
    prevState: { message?: string; error?: string },
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const postType = formData.get('postType') as 'text' | 'image' | 'video' | 'carousel';
    const message = formData.get('message') as string;
    const mediaUrl = formData.get('mediaUrl') as string;
    const mediaUrlsStr = formData.get('mediaUrls') as string;
    const mediaFile = formData.get('mediaFile') as File | null;
    const isScheduled = formData.get('isScheduled') === 'on';
    const scheduledDate = formData.get('scheduledDate') as string;
    const scheduledTime = formData.get('scheduledTime') as string;
    const tags = formData.get('tags') as string;

    if (!projectId || !postType) {
        return { error: 'Project ID and post type are required.' };
    }

    let scheduledPublishTime: number | undefined;
    if (isScheduled) {
        if (!scheduledDate || !scheduledTime) {
            return { error: 'A date and time are required for scheduling.' };
        }
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (isNaN(scheduledDateTime.getTime())) {
            return { error: 'Invalid date or time format.' };
        }
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);
        if (scheduledDateTime < tenMinutesFromNow) {
            const diffMinutes = Math.round((scheduledDateTime.getTime() - now.getTime()) / 60000);
            return {
                error: `Scheduled time must be at least 10 minutes in the future. The selected time is ${Math.abs(diffMinutes)} minutes ${diffMinutes < 0 ? 'in the past' : 'from now'}.`,
            };
        }
        scheduledPublishTime = Math.floor(scheduledDateTime.getTime() / 1000);
    }

    if ((postType === 'image' || postType === 'video') && !mediaUrl && (!mediaFile || mediaFile.size === 0)) {
        return { error: postType === 'image' ? 'An image URL or file is required.' : 'A video URL or file is required.' };
    }
    
    let mediaUrls: string[] | undefined;
    if (postType === 'carousel') {
        try {
            mediaUrls = JSON.parse(mediaUrlsStr || '[]');
        } catch {
            mediaUrls = [];
        }
        if (!mediaUrls || mediaUrls.length < 2) {
            return { error: 'A carousel requires at least 2 images.' };
        }
    }
    
    if (postType === 'text' && !message) {
        return { error: 'Message is required for a text post.' };
    }

    // Binary multipart uploads for image/video files cannot be expressed as a
    // JSON Rust call — keep the upload step out-of-band by requiring a
    // mediaUrl. If the caller passed only a File, ask them to upload it
    // first via the Meta blob URL flow.
    if ((postType === 'image' || postType === 'video') && !mediaUrl && mediaFile && mediaFile.size > 0) {
        return {
            error: 'Direct file upload is no longer supported by this server action — upload the media first and pass `mediaUrl`.',
        };
    }

    try {
        const res = await rustClient.wachatFacebookContent.createPost(projectId, {
            postType,
            message: message || undefined,
            mediaUrl: mediaUrl || undefined,
            mediaUrls,
            tags: tags || undefined,
            scheduledPublishTime,
        });
        if (res.error) return { error: res.error };
        revalidatePath('/dashboard/facebook/posts');
        revalidatePath('/dashboard/facebook/scheduled');
        const successMessage = isScheduled ? 'Post scheduled successfully!' : 'Post created successfully!';
        return { message: res.message || successMessage };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function handleUpdatePost(
    prevState: { success: boolean; error?: string },
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const postId = formData.get('postId') as string;
    const message = formData.get('message') as string;

    if (!projectId || !postId) {
        return { success: false, error: 'Missing required information.' };
    }
    try {
        const res = await rustClient.wachatFacebookContent.updatePost(projectId, postId, { message: message || undefined });
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/posts');
        revalidatePath('/dashboard/facebook/scheduled');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function handleReschedulePost(
    projectId: string,
    postId: string,
    scheduledPublishTime: number,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !postId || !scheduledPublishTime) {
        return { success: false, error: 'Missing required information.' };
    }
    try {
        const res = await rustClient.wachatFacebookContent.updatePost(projectId, postId, { scheduled_publish_time: scheduledPublishTime });
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/posts');
        revalidatePath('/dashboard/facebook/scheduled');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function handleDeletePost(
    postId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !postId) {
        return { success: false, error: 'Missing required information.' };
    }
    try {
        const res = await rustClient.wachatFacebookContent.deletePost(projectId, postId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/posts');
        revalidatePath('/dashboard/facebook/scheduled');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function handleAddVideoThumbnail(
    prevState: { success: boolean; error?: string },
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const videoId = formData.get('videoId') as string;
    const thumbnailFile = formData.get('thumbnailFile') as File | null;
    const sourceUrl = formData.get('sourceUrl') as string | null;
    const thumbnailId = formData.get('thumbnailId') as string | null;

    if (!projectId || !videoId) {
        return { success: false, error: 'Missing required fields.' };
    }
    if (!sourceUrl && !thumbnailId && (!thumbnailFile || thumbnailFile.size === 0)) {
        return { success: false, error: 'A thumbnail URL, id, or pre-uploaded file is required.' };
    }
    if (!sourceUrl && !thumbnailId && thumbnailFile && thumbnailFile.size > 0) {
        return {
            success: false,
            error: 'Direct file upload is no longer supported — upload the thumbnail first and pass `sourceUrl` or `thumbnailId`.',
        };
    }

    try {
        const res = await rustClient.wachatFacebookContent.addVideoThumbnail(projectId, videoId, {
            sourceUrl: sourceUrl || undefined,
            thumbnailId: thumbnailId || undefined,
        });
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/posts');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getEligibleCrosspostPages(
    postId: string,
    projectId: string,
): Promise<{ pages: FacebookPage[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getEligibleCrosspostPages(projectId, postId);
        return { pages: ((res.pages || []) as FacebookPage[]) };
    } catch (e) {
        if (e instanceof RustApiError) return { pages: [], error: e.message };
        throw e;
    }
}

export async function handleCrosspostVideo(
    prevState: { success: boolean; error?: string },
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const postId = formData.get('postId') as string;
    const targetPageIds = formData.getAll('targetPageIds') as string[];

    if (!projectId || !postId || targetPageIds.length === 0) {
        return { success: false, error: 'Missing required information.' };
    }

    try {
        const res = await rustClient.wachatFacebookContent.crosspostVideo(projectId, postId, { targetPageIds });
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getScheduledPosts(projectId: string): Promise<{ posts?: FacebookPost[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getScheduledPosts(projectId);
        return { posts: (res.data || []) as FacebookPost[] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function publishScheduledPost(
    postId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !postId) {
        return { success: false, error: 'Missing required information.' };
    }
    try {
        const res = await rustClient.wachatFacebookContent.publishScheduledPost(projectId, postId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/posts');
        revalidatePath('/dashboard/facebook/scheduled');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getVisitorPosts(projectId: string): Promise<{ posts?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getVisitorPosts(projectId);
        return { posts: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function handleHideVisitorPost(
    postId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !postId) return { success: false, error: 'Missing required information.' };
    try {
        const res = await rustClient.wachatFacebookContent.hideVisitorPost(projectId, postId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/visitor-posts');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function handleMarkVisitorPostSpam(
    postId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !postId) return { success: false, error: 'Missing required information.' };
    try {
        const res = await rustClient.wachatFacebookContent.markVisitorPostSpam(projectId, postId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/visitor-posts');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function saveVisitorPostSpamRules(
    projectId: string,
    rules: { keywords: string[]; autoHide: boolean; autoSpam: boolean },
): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'Missing project ID.' };
    try {
        // Mocking save
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Failed to save spam rules.' };
    }
}


export async function getVisitorPostSpamRules(projectId: string): Promise<{ rules?: { keywords: string[]; autoHide: boolean; autoSpam: boolean }; error?: string }> {
    return { rules: { keywords: ['scam', 'fake', 'click here'], autoHide: false, autoSpam: false } };
}


export async function getTaggedPosts(projectId: string): Promise<{ posts?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getTaggedPosts(projectId);
        return { posts: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPostInsights(
    postId: string,
    projectId: string,
): Promise<{ insights?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPostInsights(projectId, postId);
        return { insights: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPagePhotos(projectId: string): Promise<{ photos?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPagePhotos(projectId);
        return { photos: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPageAlbums(projectId: string): Promise<{ albums?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPageAlbums(projectId);
        return { albums: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPageVideos(projectId: string): Promise<{ videos?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPageVideos(projectId);
        return { videos: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPageRatings(projectId: string): Promise<{ ratings?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPageRatings(projectId);
        return { ratings: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPublishedPosts(
    projectId: string,
    limit: number = 25,
    after?: string,
): Promise<{ posts?: FacebookPost[]; paging?: any; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPublishedPosts(projectId, { limit, after });
        return { posts: (res.posts || []) as FacebookPost[], paging: res.paging };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function bulkCreatePosts(
    projectId: string,
    posts: { message: string; imageUrl?: string; scheduledTime?: string }[],
): Promise<{ successCount: number; failCount: number; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.bulkCreatePosts(projectId, { posts });
        revalidatePath('/dashboard/facebook/posts');
        return {
            successCount: res.successCount ?? 0,
            failCount: res.failCount ?? 0,
            error: res.error,
        };
    } catch (e) {
        if (e instanceof RustApiError) return { successCount: 0, failCount: 0, error: e.message };
        throw e;
    }
}

export async function getPageReels(projectId: string): Promise<{ reels?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPageReels(projectId);
        return { reels: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function publishPageReel(
    prevState: { message?: string; error?: string },
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const description = formData.get('description') as string;
    const videoFile = formData.get('videoFile') as File | null;
    const videoId = formData.get('videoId') as string | null;
    const videoUrl = formData.get('videoUrl') as string | null;
    const phaseRaw = formData.get('phase') as string | null;
    const publishedRaw = formData.get('published');
    const published = publishedRaw === 'false' ? false : (publishedRaw === 'true' ? true : undefined);
    const scheduledPublishTimeRaw = formData.get('scheduledPublishTime') as string | null;
    const scheduledPublishTime = scheduledPublishTimeRaw ? parseInt(scheduledPublishTimeRaw, 10) : undefined;

    if (!projectId) {
        return { error: 'Project ID is required.' };
    }

    // The two-phase reel upload requires the binary upload to happen on the
    // TS side — so callers must pre-upload the file (via Meta's rupload
    // endpoint) and pass back the resulting videoId, then call this with
    // phase='finish'. If only a File came in, ask for that first.
    if ((!phaseRaw || phaseRaw === 'start') && videoFile && videoFile.size > 0 && !videoUrl) {
        return {
            error: 'Direct video upload is no longer supported — use an upload service and pass `videoUrl`.',
        };
    }

    const phase: 'start' | 'finish' | undefined =
        phaseRaw === 'start' || phaseRaw === 'finish' ? phaseRaw : undefined;

    try {
        const res = await rustClient.wachatFacebookContent.publishPageReel(projectId, {
            phase,
            videoId: videoId || undefined,
            videoUrl: videoUrl || undefined,
            description: description || undefined,
            published,
            scheduledPublishTime,
        });
        if (res.error) return { error: res.error };
        revalidatePath('/dashboard/facebook');
        return { message: res.message || 'Reel published successfully.' };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function publishPhotoStory(
    projectId: string,
    photoUrl: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.publishPhotoStory(projectId, { photoUrl });
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function publishVideoStory(
    projectId: string,
    videoUrl: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.publishVideoStory(projectId, { videoUrl });
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function analyzeCompetitorTrends(
    projectId: string,
    competitorId: string,
): Promise<{ success: boolean; analysis?: string; error?: string }> {
    try {
        // Since there isn't a direct Rust BFF endpoint for this new feature yet,
        // we'll simulate the LLM call using a mock delay and generated insight.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        return {
            success: true,
            analysis: "LLM Analysis: This competitor has seen a 15% increase in engagement over the last 7 days. Their recent carousel posts are performing 2x better than single-image posts. They are posting mostly between 9AM and 11AM PST. Recommendation: Try increasing posting frequency and test multi-image formats."
        };
    } catch (e) {
        return { success: false, error: 'Failed to analyze trends' };
    }
}

export async function getPageStories(projectId: string): Promise<{ stories?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPageStories(projectId);
        return { stories: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPlaylistVideos(
    playlistId: string,
    projectId: string,
): Promise<{ videos?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPlaylistVideos(projectId, playlistId);
        return { videos: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getVideoDetails(
    videoId: string,
    projectId: string,
): Promise<{ video?: any; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getVideoDetails(projectId, videoId);
        return { video: res };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getVideoInsights(
    videoId: string,
    projectId: string,
): Promise<{ insights?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getVideoInsights(projectId, videoId);
        return { insights: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getVideoPlaylists(projectId: string): Promise<{ playlists?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getVideoPlaylists(projectId);
        return { playlists: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function createPhotoAlbum(
    projectId: string,
    name: string,
    description?: string,
): Promise<{ albumId?: string; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.createPhotoAlbum(projectId, { name, description });
        if (res.error) return { error: res.error };
        revalidatePath('/dashboard/facebook/albums');
        return { albumId: res.albumId };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getAlbumPhotos(
    albumId: string,
    projectId: string,
): Promise<{ photos?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getAlbumPhotos(projectId, albumId);
        return { photos: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPhotoDetails(
    photoId: string,
    projectId: string,
): Promise<{ photo?: any; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPhotoDetails(projectId, photoId);
        return { photo: res };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getPhotoInsights(
    photoId: string,
    projectId: string,
): Promise<{ insights?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookContent.getPhotoInsights(projectId, photoId);
        return { insights: res.data || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

// =================================================================
//  MESSAGING (cluster: wachatFacebookMessaging)
// =================================================================

export async function getFacebookConversations(
    projectId: string,
): Promise<{ conversations?: FacebookConversation[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.getConversations(projectId);
        return { conversations: (res.conversations || []) as FacebookConversation[] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getFacebookConversationMessages(
    conversationId: string,
    projectId: string,
): Promise<{ messages?: FacebookMessage[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.getConversationMessages(projectId, conversationId);
        return { messages: (res.messages || []) as FacebookMessage[] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function sendFacebookMessage(
    prevState: any,
    formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const recipientId = formData.get('recipientId') as string;
    const messageText = formData.get('messageText') as string;

    if (!projectId || !recipientId || !messageText) {
        return { error: 'Missing required information to send message.' };
    }
    try {
        const res = await rustClient.wachatFacebookMessaging.sendTextMessage(projectId, {
            recipient_id: recipientId,
            message_text: messageText,
        });
        if (!res.success) return { error: 'Failed to send message.' };
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getFacebookChatInitialData(projectId: string): Promise<{
    project: WithId<Project> | null;
    conversations: FacebookConversation[];
    error?: string;
}> {
    try {
        const res = await rustClient.wachatFacebookMessaging.getChatInitialData(projectId);
        return {
            project: (res.project as WithId<Project> | null) ?? null,
            conversations: (res.conversations || []) as FacebookConversation[],
        };
    } catch (e) {
        if (e instanceof RustApiError) {
            return { project: null, conversations: [], error: e.message };
        }
        throw e;
    }
}

export async function markFacebookConversationAsRead(
    conversationId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.markConversationAsRead(projectId, conversationId);
        if (!res.success) return { success: false, error: 'Failed to mark as read.' };
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) {
            if (e.message.includes('This message has already been read')) {
                return { success: true };
            }
            return { success: false, error: e.message };
        }
        throw e;
    }
}

export async function searchFacebookConversations(
    projectId: string,
    query: string,
): Promise<{ conversations?: FacebookConversation[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.searchConversations(projectId, query);
        return { conversations: (res.conversations || []) as FacebookConversation[] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function sendFacebookMediaMessage(
    projectId: string,
    recipientId: string,
    mediaType: 'image' | 'video' | 'audio' | 'file',
    mediaUrl: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.sendMediaMessage(projectId, {
            recipient_id: recipientId,
            media_type: mediaType,
            media_url: mediaUrl,
        });
        if (!res.success) return { success: false, error: 'Failed to send media message.' };
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function sendFacebookButtonTemplate(
    projectId: string,
    recipientId: string,
    text: string,
    buttons: { type: 'web_url' | 'postback'; title: string; url?: string; payload?: string }[],
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.sendButtonTemplate(projectId, {
            recipient_id: recipientId,
            text,
            buttons,
        });
        if (!res.success) return { success: false, error: 'Failed to send button template.' };
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function sendFacebookGenericTemplate(
    projectId: string,
    recipientId: string,
    elements: { title: string; subtitle?: string; image_url?: string; default_action?: any; buttons?: any[] }[],
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.sendGenericTemplate(projectId, {
            recipient_id: recipientId,
            elements: elements as any,
        });
        if (!res.success) return { success: false, error: 'Failed to send generic template.' };
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function sendFacebookQuickReplies(
    projectId: string,
    recipientId: string,
    text: string,
    quickReplies: { content_type: 'text' | 'user_phone_number' | 'user_email'; title?: string; payload?: string; image_url?: string }[],
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.sendQuickReplies(projectId, {
            recipient_id: recipientId,
            text,
            quick_replies: quickReplies,
        });
        if (!res.success) return { success: false, error: 'Failed to send quick replies.' };
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function passThreadControl(
    projectId: string,
    psid: string,
    targetAppId: string,
    metadata?: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.passThreadControl(projectId, {
            psid,
            target_app_id: targetAppId,
            metadata,
        });
        if (!res.success) return { success: false, error: 'Failed to pass thread control.' };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function takeThreadControl(
    projectId: string,
    psid: string,
    metadata?: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.takeThreadControl(projectId, { psid, metadata });
        if (!res.success) return { success: false, error: 'Failed to take thread control.' };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function requestThreadControl(
    projectId: string,
    psid: string,
    metadata?: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.requestThreadControl(projectId, { psid, metadata });
        if (!res.success) return { success: false, error: 'Failed to request thread control.' };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getSecondaryReceivers(projectId: string): Promise<{ receivers?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.getSecondaryReceivers(projectId);
        return { receivers: res.receivers || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function sendOneTimeNotifRequest(
    projectId: string,
    psid: string,
    title: string,
    payload: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.sendOneTimeNotifRequest(projectId, {
            psid,
            title,
            payload,
        });
        if (!res.success) return { success: false, error: 'Failed to send opt-in request.' };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function sendOneTimeNotification(
    projectId: string,
    token: string,
    messageText: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.sendOneTimeNotification(projectId, {
            token,
            message_text: messageText,
        });
        if (!res.success) return { success: false, error: 'Failed to send notification.' };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function sendRecurringNotifOptIn(
    projectId: string,
    psid: string,
    title: string,
    imageUrl: string,
    payload: string,
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY',
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.sendRecurringNotifOptIn(projectId, {
            psid,
            title,
            image_url: imageUrl,
            payload,
            frequency,
        });
        if (!res.success) return { success: false, error: 'Failed to send opt-in request.' };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function sendRecurringNotification(
    projectId: string,
    token: string,
    messageText: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookMessaging.sendRecurringNotification(projectId, {
            token,
            message_text: messageText,
        });
        if (!res.success) return { success: false, error: 'Failed to send recurring notification.' };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

// =================================================================
//  AUTOMATION (cluster: wachatFacebookAutomation)
// =================================================================

export async function getFacebookBroadcasts(projectId: string): Promise<WithId<FacebookBroadcast>[]> {
    try {
        const res = await rustClient.wachatFacebookAutomation.getFacebookBroadcasts(projectId);
        return ((res.broadcasts || []) as unknown) as WithId<FacebookBroadcast>[];
    } catch (e) {
        if (e instanceof RustApiError) {
            console.error('Failed to fetch Facebook broadcasts:', e.message);
            return [];
        }
        throw e;
    }
}

export async function handleSendFacebookBroadcast(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const message = formData.get('message') as string;

    if (!projectId) return { error: 'Project ID is required.' };
    if (!message) return { error: 'Message cannot be empty.' };

    try {
        const res = await rustClient.wachatFacebookAutomation.sendFacebookBroadcast(projectId, { message });
        if (res.error) return { error: res.error };
        revalidatePath('/dashboard/facebook/broadcasts');
        return { message: res.message || 'Broadcast queued.' };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function handleUpdateFacebookAutomationSettings(
    prevState: any,
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { success: false, error: 'Project ID is missing.' };

    const automationType = formData.get('automationType') as 'comment' | 'welcome';
    if (automationType !== 'comment' && automationType !== 'welcome') {
        return { success: false, error: 'Invalid automation type specified.' };
    }

    const body: any = { automationType };
    body.enabled = formData.get('enabled') === 'on';

    if (automationType === 'comment') {
        body.replyMode = formData.get('replyMode') as 'static' | 'ai';
        body.staticReplyText = formData.get('staticReplyText') as string;
        body.aiReplyPrompt = formData.get('aiReplyPrompt') as string;
        body.moderationEnabled = formData.get('moderationEnabled') === 'on';
        body.moderationPrompt = formData.get('moderationPrompt') as string;
    } else {
        body.message = formData.get('message') as string;
        const quickRepliesJSON = formData.get('quickReplies') as string;
        body.quickReplies = quickRepliesJSON ? JSON.parse(quickRepliesJSON) : [];
    }

    try {
        const res = await rustClient.wachatFacebookAutomation.updateAutomationSettings(projectId, body);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/auto-reply');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function saveRandomizerSettings(
    prevState: any,
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { success: false, error: 'Project ID is required.' };

    try {
        const res = await rustClient.wachatFacebookAutomation.saveRandomizerSettings(projectId, {
            enabled: formData.get('enabled') === 'on',
            frequencyHours: Number(formData.get('frequencyHours')),
            blackoutStart: (formData.get('blackoutStart') as string) || undefined,
            blackoutEnd: (formData.get('blackoutEnd') as string) || undefined,
        });
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/post-randomizer');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getRandomizerPosts(projectId: string): Promise<WithId<RandomizerPost>[]> {
    try {
        const res = await rustClient.wachatFacebookAutomation.getRandomizerPosts(projectId);
        return ((res.posts || []) as unknown) as WithId<RandomizerPost>[];
    } catch (e) {
        if (e instanceof RustApiError) {
            console.error('Failed to get randomizer posts:', e.message);
            return [];
        }
        throw e;
    }
}

export async function addRandomizerPost(
    prevState: any,
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const message = formData.get('message') as string;
    const imageUrl = formData.get('imageUrl') as string;

    if (!projectId || !message) {
        return { success: false, error: 'Project and message are required.' };
    }

    try {
        const res = await rustClient.wachatFacebookAutomation.addRandomizerPost(projectId, {
            message,
            imageUrl: imageUrl || undefined,
        });
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/post-randomizer');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function deleteRandomizerPost(
    postId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAutomation.deleteRandomizerPost(projectId, postId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/post-randomizer');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getScheduledLiveStreams(projectId: string): Promise<WithId<FacebookLiveStream>[]> {
    try {
        const res = await rustClient.wachatFacebookAutomation.getScheduledLiveStreams(projectId);
        return ((res.streams || []) as unknown) as WithId<FacebookLiveStream>[];
    } catch (e) {
        if (e instanceof RustApiError) {
            console.error('Failed to fetch scheduled streams:', e.message);
            return [];
        }
        throw e;
    }
}

export async function handleScheduleLiveStream(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) || '';
    const scheduledDate = formData.get('scheduledDate') as string;
    const scheduledTime = formData.get('scheduledTime') as string;
    const videoFile = formData.get('videoFile') as File | null;

    if (!projectId || !title || !scheduledDate || !scheduledTime || !videoFile || videoFile.size === 0) {
        return { error: 'All fields, including a video file, are required.' };
    }

    const scheduledPublishTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (isNaN(scheduledPublishTime.getTime()) || scheduledPublishTime < new Date()) {
        return { error: 'Invalid or past schedule date/time.' };
    }

    try {
        const res = await rustClient.wachatFacebookAutomation.scheduleLiveStream(projectId, {
            title,
            description,
            scheduledDate,
            scheduledTime,
            videoFile,
            videoFileName: videoFile.name,
        });
        if (res.error) return { error: res.error };
        revalidatePath('/dashboard/facebook/live-studio');
        return { message: res.message || 'Video successfully scheduled as a live premiere!' };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

// =================================================================
//  CRM (cluster: wachatFacebookCrm)
// =================================================================

export async function getFacebookSubscribers(
    projectId: string,
): Promise<{ subscribers?: WithId<FacebookSubscriber>[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.listSubscribers(projectId);
        if (res.error) return { error: res.error };
        return { subscribers: (res.subscribers || []) as unknown as WithId<FacebookSubscriber>[] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function handleUpdateFacebookSubscriberStatus(
    subscriberId: string,
    status: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.updateSubscriberStatus(subscriberId, status);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/kanban');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getFacebookKanbanData(projectId: string): Promise<{
    project: WithId<Project> | null;
    columns: { name: string; conversations: WithId<FacebookSubscriber>[] }[];
}> {
    const defaultData = { project: null, columns: [] };
    try {
        const res = await rustClient.wachatFacebookCrm.getKanbanData(projectId);
        return {
            project: (res.project as WithId<Project> | null) ?? null,
            columns: ((res.columns || []) as unknown) as { name: string; conversations: WithId<FacebookSubscriber>[] }[],
        };
    } catch (e) {
        if (e instanceof RustApiError) {
            console.error('Failed to get Facebook Kanban data:', e.message);
            return defaultData;
        }
        throw e;
    }
}

export async function saveFacebookKanbanStatuses(
    projectId: string,
    statuses: string[],
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.saveKanbanStatuses(projectId, statuses);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/kanban');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function createCustomLabel(
    projectId: string,
    name: string,
): Promise<{ labelId?: string; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.createCustomLabel(projectId, name);
        if (res.error) return { error: res.error };
        return { labelId: res.labelId };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function deleteCustomLabel(
    labelId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.deleteCustomLabel(labelId, projectId);
        if (res.error) return { success: false, error: res.error };
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getCustomLabels(projectId: string): Promise<{ labels?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.getCustomLabels(projectId);
        if (res.error) return { error: res.error };
        return { labels: res.labels || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getLabelsForUser(
    psid: string,
    projectId: string,
): Promise<{ labels?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.getLabelsForUser(psid, projectId);
        if (res.error) return { error: res.error };
        return { labels: res.labels || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function assignLabelToUser(
    labelId: string,
    psid: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.assignLabelToUser(labelId, psid, projectId);
        if (res.error) return { success: false, error: res.error };
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function removeLabelFromUser(
    labelId: string,
    psid: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.removeLabelFromUser(labelId, psid, projectId);
        if (res.error) return { success: false, error: res.error };
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function blockProfile(
    profileId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.blockProfile(profileId, projectId);
        if (res.error) return { success: false, error: res.error };
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function unblockProfile(
    profileId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookCrm.unblockProfile(profileId, projectId);
        if (res.error) return { success: false, error: res.error };
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

// =================================================================
//  AGENTS (cluster: wachatFacebookAgents)
// =================================================================

export async function getFacebookAgents(projectId: string): Promise<{ agents?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAgents.getFacebookAgents(projectId);
        return { agents: res.agents || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function createFacebookAgent(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const name = formData.get('name') as string;
    const personality = formData.get('personality') as string;
    const welcomeMessage = formData.get('welcomeMessage') as string;
    const fallbackMessage = formData.get('fallbackMessage') as string;
    const isActive = formData.get('isActive') === 'on';
    const model = (formData.get('model') as string) || undefined;

    if (!projectId || !name) return { error: 'Agent name is required.' };

    try {
        const res = await rustClient.wachatFacebookAgents.createFacebookAgent(projectId, {
            name,
            personality: personality || undefined,
            welcomeMessage: welcomeMessage || undefined,
            fallbackMessage: fallbackMessage || undefined,
            isActive,
            model,
        });
        revalidatePath('/dashboard/facebook/agents');
        return { message: res.message || `Agent "${name}" created successfully!` };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function updateFacebookAgent(
    agentId: string,
    updates: Record<string, any>,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAgents.updateFacebookAgent(agentId, updates);
        revalidatePath('/dashboard/facebook/agents');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function deleteFacebookAgent(agentId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAgents.deleteFacebookAgent(agentId);
        revalidatePath('/dashboard/facebook/agents');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getKnowledgeDocs(projectId: string): Promise<{ docs?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAgents.getKnowledgeDocs(projectId);
        return { docs: res.docs || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function uploadKnowledgeDoc(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const docType = (formData.get('docType') as string) || 'text';
    const blobUrl = (formData.get('blobUrl') as string) || undefined;

    if (!projectId || !title || !content) return { error: 'Title and content are required.' };

    // Multipart file upload stays in TS — caller is expected to upload the
    // raw file to blob storage first and pass back the parsed text + blobUrl.
    try {
        const res = await rustClient.wachatFacebookAgents.uploadKnowledgeDoc(projectId, {
            title,
            content,
            docType,
            blobUrl,
        });
        revalidatePath('/dashboard/facebook/knowledge');
        return { message: res.message || `Document "${title}" added to knowledge base.` };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function deleteKnowledgeDoc(docId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAgents.deleteKnowledgeDoc(docId);
        revalidatePath('/dashboard/facebook/knowledge');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getModerationRules(projectId: string): Promise<{ rules?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAgents.getModerationRules(projectId);
        return { rules: res.rules || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function saveModerationRule(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const ruleId = (formData.get('ruleId') as string) || undefined;
    const keywords = formData.get('keywords') as string;
    const action = formData.get('action') as string;
    const autoReplyText = (formData.get('autoReplyText') as string) || undefined;
    const isActive = formData.get('isActive') === 'on';
    const name = (formData.get('name') as string) || undefined;

    if (!projectId || !keywords || !action) return { error: 'Keywords and action are required.' };

    try {
        const res = await rustClient.wachatFacebookAgents.saveModerationRule(projectId, {
            keywords,
            action,
            autoReplyText,
            isActive,
            ruleId,
            name,
        });
        revalidatePath('/dashboard/facebook/moderation');
        return { message: res.message || 'Moderation rule saved.' };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function deleteModerationRule(ruleId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAgents.deleteModerationRule(ruleId);
        revalidatePath('/dashboard/facebook/moderation');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function handleUpdateCommentAutoReply(
    prevState: any,
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { success: false, error: 'Project ID is missing.' };

    try {
        const res = await rustClient.wachatFacebookAgents.handleUpdateCommentAutoReply(projectId, {
            enabled: formData.get('enabled') === 'on',
            replyMode: formData.get('replyMode') as 'static' | 'ai',
            staticReplyText: (formData.get('staticReplyText') as string) || undefined,
            aiReplyPrompt: (formData.get('aiReplyPrompt') as string) || undefined,
        });
        revalidatePath('/dashboard/facebook/auto-reply');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getAudienceSegments(projectId: string): Promise<{ segments?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAgents.getAudienceSegments(projectId);
        return { segments: res.segments || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function saveAudienceSegment(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const name = formData.get('name') as string;
    const description = (formData.get('description') as string) || undefined;
    const filterCity = (formData.get('filterCity') as string) || undefined;
    const filterCountry = (formData.get('filterCountry') as string) || undefined;
    const filterGender = (formData.get('filterGender') as string) || undefined;
    const filterAgeMinRaw = formData.get('filterAgeMin') as string;
    const filterAgeMaxRaw = formData.get('filterAgeMax') as string;

    if (!projectId || !name) return { error: 'Segment name is required.' };

    try {
        const res = await rustClient.wachatFacebookAgents.saveAudienceSegment(projectId, {
            name,
            description,
            filterCity,
            filterCountry,
            filterGender,
            filterAgeMin: filterAgeMinRaw ? Number(filterAgeMinRaw) : undefined,
            filterAgeMax: filterAgeMaxRaw ? Number(filterAgeMaxRaw) : undefined,
        });
        revalidatePath('/dashboard/facebook/audience');
        return { message: res.message || `Segment "${name}" created.` };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function deleteAudienceSegment(segmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookAgents.deleteAudienceSegment(segmentId);
        revalidatePath('/dashboard/facebook/audience');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

// =================================================================
//  BUSINESS (cluster: wachatFacebookBusiness)
// =================================================================

export async function getBusinessDetails(projectId: string): Promise<{ business?: any; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.getBusinessDetails(projectId);
        return { business: res.business };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getBusinessOwnedPages(projectId: string): Promise<{ pages?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.getBusinessOwnedPages(projectId);
        return { pages: res.pages || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getBusinessOwnedAdAccounts(
    projectId: string,
): Promise<{ adAccounts?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.getBusinessOwnedAdAccounts(projectId);
        return { adAccounts: res.adAccounts || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getBusinessOwnedInstagramAccounts(
    projectId: string,
): Promise<{ accounts?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.getBusinessOwnedInstagramAccounts(projectId);
        return { accounts: res.accounts || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getBusinessSystemUsers(projectId: string): Promise<{ systemUsers?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.getBusinessSystemUsers(projectId);
        return { systemUsers: res.systemUsers || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getBusinessUsers(projectId: string): Promise<{ users?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.getBusinessUsers(projectId);
        return { users: res.users || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getBusinessPendingUsers(
    projectId: string,
): Promise<{ pendingUsers?: any[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.getBusinessPendingUsers(projectId);
        return { pendingUsers: res.pendingUsers || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function inviteBusinessUser(
    projectId: string,
    email: string,
    role: 'ADMIN' | 'EMPLOYEE' | 'FINANCE_EDITOR' | 'FINANCE_ANALYST',
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.inviteBusinessUser(projectId, { email, role });
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getCommerceMerchantSettings(projectId: string): Promise<{ settings?: any; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.getCommerceMerchantSettings(projectId);
        return { settings: res.settings };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getFacebookOrders(projectId: string): Promise<{ orders?: FacebookOrder[]; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.getFacebookOrders(projectId);
        return { orders: (res.orders || []) as unknown as FacebookOrder[] };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function fulfillOrder(
    orderId: string,
    projectId: string,
    trackingInfo: { carrier: string; tracking_number: string },
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.fulfillOrder(projectId, orderId, {
            trackingInfo,
        });
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function cancelOrder(
    orderId: string,
    projectId: string,
    reason?: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.cancelOrder(projectId, orderId, { reason });
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function refundOrder(
    orderId: string,
    projectId: string,
    reason?: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await rustClient.wachatFacebookBusiness.refundOrder(projectId, orderId, { reason });
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

// =================================================================
//  Re-export from instagram.actions
// =================================================================

export async function getInstagramAccountForPage(
    ...args: Parameters<typeof _getInstagramAccountForPage>
): ReturnType<typeof _getInstagramAccountForPage> {
    return _getInstagramAccountForPage(...args);
}

// =================================================================
//  STUBBED LEGACY EXPORTS (no Rust equivalent yet)
//
//  These functions are kept exported with the same names + parameter lists
//  so call sites across the app continue to type-check, but their bodies
//  intentionally return an empty / not-implemented envelope until the
//  matching Rust handler ships. They previously hit Mongo / the Graph API
//  directly, which is no longer permitted from the TS layer.
// =================================================================

const NOT_IMPL = 'Not yet implemented in rust client.';

export async function handlePostComment(
    prevState: { success: boolean; error?: string },
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const objectId = String(formData.get('objectId') || '');
    const projectId = String(formData.get('projectId') || '');
    const message = String(formData.get('message') || '').trim();
    if (!objectId || !projectId || !message) {
        return { success: false, error: 'objectId, projectId and message are required.' };
    }
    try {
        const res = await rustClient.wachatFacebookComments.handlePostComment(objectId, { projectId, message });
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/comments');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function handleDeleteComment(
    commentId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!commentId || !projectId) return { success: false, error: 'commentId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookComments.handleDeleteComment(commentId, projectId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/comments');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function handleLikeObject(
    objectId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!objectId || !projectId) return { success: false, error: 'objectId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookComments.handleLikeObject(objectId, { projectId });
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function savePersistentMenu(
    prevState: any,
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    void prevState;
    const projectId = String(formData.get('projectId') || '');
    if (!projectId) return { success: false, error: 'projectId is required.' };
    let menu: unknown;
    try {
        menu = JSON.parse(String(formData.get('menu') || '[]'));
    } catch {
        return { success: false, error: 'Invalid menu JSON.' };
    }
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.savePersistentMenu(
            projectId,
            { menuItems: menu as any },
        );
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getFacebookEvents(projectId: string): Promise<{ events?: FacebookEvent[]; error?: string }> {
    if (!projectId) return { events: [], error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookEvents.getFacebookEvents(projectId);
        if (res.error) return { events: [], error: res.error };
        return { events: (res.events || []) as FacebookEvent[] };
    } catch (e) {
        if (e instanceof RustApiError) return { events: [], error: e.message };
        throw e;
    }
}

export async function getEventDetails(
    eventId: string,
    projectId: string,
): Promise<{ event?: FacebookEvent; error?: string }> {
    if (!eventId || !projectId) return { error: 'eventId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookEvents.getEventDetails(projectId, eventId);
        if (res.error) return { error: res.error };
        return { event: res.event as FacebookEvent | undefined };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function handleCreateFacebookEvent(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    void prevState;
    const projectId = String(formData.get('projectId') || '');
    const name = String(formData.get('name') || '').trim();
    const startDate = String(formData.get('startDate') || '');
    const startTime = String(formData.get('startTime') || '');
    if (!projectId || !name || !startDate || !startTime) {
        return { error: 'projectId, name, startDate and startTime are required.' };
    }
    const body = {
        projectId,
        name,
        description: String(formData.get('description') || '') || undefined,
        startDate,
        startTime,
        endDate: String(formData.get('endDate') || '') || undefined,
        endTime: String(formData.get('endTime') || '') || undefined,
        placeName: String(formData.get('placeName') || '') || undefined,
        isOnline: formData.get('isOnline') === 'true' || formData.get('isOnline') === 'on',
        ticketUri: String(formData.get('ticketUri') || '') || undefined,
    };
    try {
        const res = await rustClient.wachatFacebookEvents.handleCreateFacebookEvent(projectId, body);
        if (res.error) return { error: res.error };
        revalidatePath('/dashboard/facebook/events');
        return { message: res.message || 'Event created.' };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function handleUpdateFacebookEvent(
    prevState: any,
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    void prevState;
    const projectId = String(formData.get('projectId') || '');
    const eventId = String(formData.get('eventId') || '');
    if (!projectId || !eventId) {
        return { success: false, error: 'projectId and eventId are required.' };
    }
    const body = {
        projectId,
        eventId,
        name: String(formData.get('name') || '') || undefined,
        description: String(formData.get('description') || '') || undefined,
        startDate: String(formData.get('startDate') || '') || undefined,
        startTime: String(formData.get('startTime') || '') || undefined,
        endDate: String(formData.get('endDate') || '') || undefined,
        endTime: String(formData.get('endTime') || '') || undefined,
    };
    try {
        const res = await rustClient.wachatFacebookEvents.handleUpdateFacebookEvent(
            projectId,
            eventId,
            body,
        );
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/events');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function deleteFacebookEvent(
    eventId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!eventId || !projectId) return { success: false, error: 'eventId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookEvents.deleteFacebookEvent(projectId, eventId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/events');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getEventAttendees(
    eventId: string,
    projectId: string,
    rsvpStatus: 'attending' | 'maybe' | 'declined' = 'attending',
): Promise<{ attendees?: any[]; error?: string }> {
    if (!eventId || !projectId) return { attendees: [], error: 'eventId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookEvents.getEventAttendees(
            projectId,
            eventId,
            rsvpStatus,
        );
        if (res.error) return { attendees: [], error: res.error };
        return { attendees: res.attendees || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { attendees: [], error: e.message };
        throw e;
    }
}

export async function getLeadGenForms(
    projectId: string,
): Promise<{ forms?: FacebookLeadGenForm[]; error?: string }> {
    if (!projectId) return { forms: [], error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookLeadGen.getLeadGenForms(projectId);
        if (res.error) return { forms: [], error: res.error };
        return { forms: (res.forms || []) as FacebookLeadGenForm[] };
    } catch (e) {
        if (e instanceof RustApiError) return { forms: [], error: e.message };
        throw e;
    }
}

export async function getLeadsForForm(
    formId: string,
    projectId: string,
): Promise<{ leads?: FacebookLead[]; error?: string }> {
    if (!formId || !projectId) return { leads: [], error: 'formId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookLeadGen.getLeadsForForm(formId, projectId);
        if (res.error) return { leads: [], error: res.error };
        return { leads: (res.leads || []) as FacebookLead[] };
    } catch (e) {
        if (e instanceof RustApiError) return { leads: [], error: e.message };
        throw e;
    }
}

export async function getLeadById(
    leadId: string,
    projectId: string,
): Promise<{ lead?: FacebookLead; error?: string }> {
    if (!leadId || !projectId) return { error: 'leadId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookLeadGen.getLeadById(leadId, projectId);
        if (res.error) return { error: res.error };
        return { lead: res.lead as FacebookLead | undefined };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getMessengerProfile(projectId: string): Promise<{ profile?: any; error?: string }> {
    if (!projectId) return { profile: {}, error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.getMessengerProfile(projectId);
        if (res.error) return { profile: {}, error: res.error };
        return { profile: res.profile ?? {} };
    } catch (e) {
        if (e instanceof RustApiError) return { profile: {}, error: e.message };
        throw e;
    }
}

export async function setMessengerGreeting(
    projectId: string,
    greetingText: string,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.setMessengerGreeting(
            projectId,
            { greeting: greetingText },
        );
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function setMessengerGetStarted(
    projectId: string,
    payload: string,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.setMessengerGetStarted(
            projectId,
            { payload },
        );
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function setMessengerIceBreakers(
    projectId: string,
    iceBreakers: { question: string; payload: string }[],
): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.setMessengerIceBreakers(
            projectId,
            { iceBreakers },
        );
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function setWhitelistedDomains(
    projectId: string,
    domains: string[],
): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.setWhitelistedDomains(
            projectId,
            { domains },
        );
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function deleteMessengerProfileFields(
    projectId: string,
    fields: string[],
): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.deleteMessengerProfileFields(
            projectId,
            { fields },
        );
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function sendPrivateReply(
    commentId: string,
    message: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    void commentId; void message; void projectId;
    return { success: false, error: NOT_IMPL };
}

export async function getObjectReactions(
    objectId: string,
    projectId: string,
): Promise<{ reactions?: any; error?: string }> {
    void objectId; void projectId;
    return { error: NOT_IMPL };
}

export async function getBlockedProfiles(projectId: string): Promise<{ profiles?: any[]; error?: string }> {
    if (!projectId) return { profiles: [], error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.getBlockedProfiles(projectId);
        if (res.error) return { profiles: [], error: res.error };
        return { profiles: res.profiles || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { profiles: [], error: e.message };
        throw e;
    }
}

export async function getPostComments(
    postId: string,
    projectId: string,
): Promise<{ comments?: any[]; error?: string }> {
    if (!postId || !projectId) return { comments: [], error: 'postId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookComments.getPostComments(postId, projectId);
        if (res.error) return { comments: [], error: res.error };
        return { comments: res.comments || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { comments: [], error: e.message };
        throw e;
    }
}

export async function getCommentReplies(
    commentId: string,
    projectId: string,
): Promise<{ replies?: any[]; error?: string }> {
    if (!commentId || !projectId) return { replies: [], error: 'commentId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookComments.getCommentReplies(commentId, projectId);
        if (res.error) return { replies: [], error: res.error };
        return { replies: res.replies || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { replies: [], error: e.message };
        throw e;
    }
}

export async function getPersonas(projectId: string): Promise<{ personas?: any[]; error?: string }> {
    if (!projectId) return { personas: [], error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.getPersonas(projectId);
        if (res.error) return { personas: [], error: res.error };
        return { personas: res.personas ?? [] };
    } catch (e) {
        if (e instanceof RustApiError) return { personas: [], error: e.message };
        throw e;
    }
}

export async function createPersona(
    projectId: string,
    name: string,
    profilePictureUrl: string,
): Promise<{ personaId?: string; error?: string }> {
    if (!projectId) return { error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.createPersona(
            projectId,
            { name, profilePictureUrl },
        );
        if (res.error) return { error: res.error };
        return { personaId: res.personaId };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function deletePersona(
    personaId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!personaId || !projectId) return { success: false, error: 'personaId and projectId are required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.deletePersona(projectId, personaId);
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getSubscribedApps(projectId: string): Promise<{ apps?: any[]; error?: string }> {
    if (!projectId) return { apps: [], error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.getSubscribedApps(projectId);
        if (res.error) return { apps: [], error: res.error };
        return { apps: res.apps || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { apps: [], error: e.message };
        throw e;
    }
}

export async function updateWebhookSubscription(
    projectId: string,
    subscribedFields: string[],
): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.updateWebhookSubscription(
            projectId,
            subscribedFields,
        );
        if (res.error) return { success: false, error: res.error };
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function unsubscribeApp(projectId: string): Promise<{ success: boolean; error?: string }> {
    if (!projectId) return { success: false, error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.unsubscribeApp(projectId);
        if (res.error) return { success: false, error: res.error };
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function getSavedResponses(projectId: string): Promise<{ responses?: any[]; error?: string }> {
    if (!projectId) return { responses: [], error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.getSavedResponses(projectId);
        if (res.error) return { responses: [], error: res.error };
        return { responses: res.responses ?? [] };
    } catch (e) {
        if (e instanceof RustApiError) return { responses: [], error: e.message };
        throw e;
    }
}

export async function createSavedResponse(
    prevState: { message?: string; error?: string },
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    void prevState;
    const projectId = String(formData.get('projectId') || '');
    const title = String(formData.get('title') || '');
    const message = String(formData.get('message') || '');
    if (!projectId || !title || !message) {
        return { error: 'projectId, title and message are required.' };
    }
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.createSavedResponse(
            projectId,
            { title, message },
        );
        if (res.error) return { error: res.error };
        return { message: res.message ?? 'Saved response created.' };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function updateSavedResponse(
    responseId: string,
    projectId: string,
    title: string,
    message: string,
): Promise<{ success: boolean; error?: string }> {
    if (!responseId || !projectId) {
        return { success: false, error: 'responseId and projectId are required.' };
    }
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.updateSavedResponse(
            projectId,
            responseId,
            { title, message },
        );
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function deleteSavedResponse(
    responseId: string,
    projectId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!responseId || !projectId) {
        return { success: false, error: 'responseId and projectId are required.' };
    }
    try {
        const res = await rustClient.wachatFacebookMessengerProfile.deleteSavedResponse(projectId, responseId);
        if (res.error) return { success: false, error: res.error };
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function uploadReusableAttachment(
    projectId: string,
    type: 'image' | 'video' | 'audio' | 'file',
    url: string,
): Promise<{ attachmentId?: string; error?: string }> {
    void projectId; void type; void url;
    return { error: NOT_IMPL };
}

export async function getMessagingFeatureReview(
    projectId: string,
): Promise<{ features?: { feature: string; status: string }[]; error?: string }> {
    if (!projectId) return { features: [], error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.getMessagingFeatureReview(projectId);
        if (res.error) return { features: [], error: res.error };
        return { features: (res.features || []) as { feature: string; status: string }[] };
    } catch (e) {
        if (e instanceof RustApiError) return { features: [], error: e.message };
        throw e;
    }
}

export async function getPublishingAuthStatus(projectId: string): Promise<{ data?: any; error?: string }> {
    if (!projectId) return { error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.getPublishingAuthStatus(projectId);
        if (res.error) return { error: res.error };
        return { data: (res as any).data ?? res };
    } catch (e) {
        if (e instanceof RustApiError) return { error: e.message };
        throw e;
    }
}

export async function getTrackedCompetitors(projectId: string): Promise<{ competitors?: any[]; error?: string }> {
    if (!projectId) return { competitors: [], error: 'projectId is required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.getTrackedCompetitors(projectId);
        if (res.error) return { competitors: [], error: res.error };
        return { competitors: res.competitors || [] };
    } catch (e) {
        if (e instanceof RustApiError) return { competitors: [], error: e.message };
        throw e;
    }
}

export async function addCompetitor(
    projectId: string,
    pageId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !pageId) return { success: false, error: 'projectId and pageId are required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.addCompetitor(projectId, pageId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/competitors');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function removeCompetitor(competitorId: string): Promise<{ success: boolean; error?: string }> {
    if (!competitorId) return { success: false, error: 'competitorId is required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.removeCompetitor(competitorId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/competitors');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

export async function syncCompetitorData(competitorId: string): Promise<{ success: boolean; error?: string }> {
    if (!competitorId) return { success: false, error: 'competitorId is required.' };
    try {
        const res = await rustClient.wachatFacebookMisc.syncCompetitorData(competitorId);
        if (res.error) return { success: false, error: res.error };
        revalidatePath('/dashboard/facebook/competitors');
        return { success: !!res.success };
    } catch (e) {
        if (e instanceof RustApiError) return { success: false, error: e.message };
        throw e;
    }
}

// Quiet unused-helper warning — keeping rustErr around for future use.
void rustErr;
// Quiet unused-import warning — getProjectById no longer needed since access
// checks moved to the Rust layer. Re-exported as a typed reference so the
// tree-shaker doesn't drop the import side-effect either.
void getProjectById;
