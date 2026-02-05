import { btoa } from "buffer";

// You should set these in your .env
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;
const BASE_URL = 'https://api.dataforseo.com/v3';

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    console.warn("DataForSEO credentials (Login/Password) are missing from environment variables.");
}

const getAuthHeader = () => {
    return `Basic ${Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')}`;
};

export type DataForSeoTaskResponse = {
    status_code: number;
    status_message: string;
    tasks?: any[];
    tasks_error?: number;
    tasks_count?: number;
};

// Generic Fetcher
async function fetchFromDataForSeo(endpoint: string, body: any): Promise<any> {
    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) throw new Error("Missing credentials");

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Authorization": getAuthHeader(),
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.status_code >= 400 && data.status_code !== 20000) { // 20000 is success in DataForSEO
        console.error(`DataForSEO Error [${endpoint}]:`, data);
        // Don't throw immediately, return data to handle specific logic? 
        // Actually, let's throw if it's a hard error
        if (data.status_code === 401) throw new Error("DataForSEO Unauthorized");
    }
    return data;
}

// 1. Google Search Volume (Live or Task)
// Using "google/keywords_data/google_ads/search_volume/live" for immediate data (more expensive) or tasks for cheaper.
// For MVP, we'll try Live to show instant results.
export async function getKeywordDataLive(keywords: string[], location_code: number = 2840, language_code: string = "en") {
    // 2840 = US
    const payload = [{
        keywords: keywords,
        location_code: location_code,
        language_name: "English"
    }];

    return await fetchFromDataForSeo('/google/keywords_data/google_ads/search_volume/live', payload);
}

// 2. SERP Results (Rank Tracking) - Live
// Check where a domain ranks for a keyword.
export async function getSerpLive(keyword: string, location_code: number = 2840) {
    const payload = [{
        keyword: keyword,
        location_code: location_code,
        language_code: "en",
        device: "desktop",
        os: "windows",
        depth: 100 // Top 100 results
    }];

    return await fetchFromDataForSeo('/google/serp/organic/live/advanced', payload);
}

// 3. YouTube Search Volume
export async function getYouTubeKeywordData(keywords: string[]) {
    // Note: DataForSEO might not have a "Live" volume endpoint for YouTube exactly like Google Ads.
    // Usually uses 'keywords_data/youtube/...' but let's assume 'app_data/google_play/...' or similar for now? 
    // Actually, DataForSEO has specific YouTube endpoints. 
    // Using a safe fallback or specific endpoint if known. 
    // For now, let's stick to Google Data as primary validation.
    console.log("YouTube API implementation pending specific endpoint verification");
    return null;
}

// Helper to extract rank from SERP response for a specific domain
export function extractRankFromSerp(serpResponse: any, targetDomain: string): number | null {
    if (!serpResponse || !serpResponse.tasks || !serpResponse.tasks[0]?.result) return null;

    const items = serpResponse.tasks[0].result[0].items;
    if (!items) return null;

    for (const item of items) {
        if (item.type === 'organic' && item.domain && item.domain.includes(targetDomain)) {
            return item.rank_group; // Position
        }
    }
    return null; // Not found in top 100
}
