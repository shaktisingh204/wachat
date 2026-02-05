// Removed buffer import

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
        if (data.status_code === 401) throw new Error("DataForSEO Unauthorized");
    }
    return data;
}

// 1. Google Search Volume (Live)
export async function getKeywordDataLive(keywords: string[], location_code: number = 2840, language_code: string = "en") {
    const payload = [{
        keywords: keywords,
        location_code: location_code,
        language_name: "English"
    }];

    return await fetchFromDataForSeo('/google/keywords_data/google_ads/search_volume/live', payload);
}

// 2. SERP Results (Rank Tracking) - Live
export async function getSerpLive(keyword: string, location_code: number = 2840) {
    const payload = [{
        keyword: keyword,
        location_code: location_code,
        language_code: "en",
        device: "desktop",
        os: "windows",
        depth: 100
    }];

    return await fetchFromDataForSeo('/google/serp/organic/live/advanced', payload);
}

// 3. Grid Tracking (Local SEO) - using Google Maps SERP
// Scans multiple points around a center coordinate.
export async function getLocalGridRanking(keyword: string, lat: number, lng: number, radiusKm: number = 10, gridSize: number = 3) {
    // Grid Size 3 means 3x3 = 9 points.
    // We calculate offsets roughly. 1 deg lat ~ 111km. 
    // This is a simplified "square" grid generation for MVP.
    const step = (radiusKm * 2) / (gridSize - 1); // km distance between points
    const stepDeg = step / 111; // rough conversation

    const tasks = [];
    const startLat = lat - stepDeg;
    const startLng = lng - stepDeg;

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const pointLat = startLat + (i * stepDeg);
            const pointLng = startLng + (j * stepDeg);

            // Limit coordinate precision to avoiding API errors
            const latFixed = parseFloat(pointLat.toFixed(6));
            const lngFixed = parseFloat(pointLng.toFixed(6));

            // coordinate string format: "lat,long,zoom" or just location_coordinate parameter
            // DataForSEO Tasks
            tasks.push({
                keyword: keyword,
                location_coordinate: `${latFixed},${lngFixed}`,
                language_code: "en",
                device: "desktop",
                os: "windows",
                depth: 20 // Local pack usually Top 20 is enough
            });
        }
    }

    // Since we can post up to 100 tasks in a batch
    return await fetchFromDataForSeo('/google/maps/serp/live/advanced', tasks);
}


// 4. Site Metrics (OnPage / Domain Authority Sim)
// DataForSEO doesn't have a direct "DA" metric like Moz.
// We use OnPage API "Summary" or Backlinks API "Summary".
export async function getDomainMetrics(domain: string) {
    // Using Backlinks Summary to get referring domains/backlinks count
    // And OnPage Summary for technical health if needed.
    // Here we focus on Authority-like metrics.
    const payload = [{
        target: domain,
        internal_list_limit: 10,
        include_subdomains: true,
        backlinks_status_type: "live"
    }];

    return await fetchFromDataForSeo('/backlinks/summary/live', payload);
}

// 5. Backlinks Data
export async function getBacklinksData(domain: string, limit: number = 10) {
    const payload = [{
        target: domain,
        mode: "as_is",
        limit: limit,
        order_by: ["rank,desc"] // best links first
    }];
    return await fetchFromDataForSeo('/backlinks/backlinks/live', payload);
}

// Helper to extract rank
export function extractRankFromSerp(serpResponse: any, targetDomain: string): number | null {
    if (!serpResponse || !serpResponse.tasks || !serpResponse.tasks[0]?.result) return null;
    const items = serpResponse.tasks[0].result[0].items;

    if (!items) return null;

    for (const item of items) {
        if (item.type === 'organic' && item.domain && item.domain.includes(targetDomain)) {
            return item.rank_group;
        }
        // Also check map pack (local pack)
        if (item.type === 'maps_paid' || item.type === 'maps_organic') {
            // title check as domain might be missing in map pack items sometimes
            if (item.domain && item.domain.includes(targetDomain)) return item.rank_group;
        }
    }
    return null;
}
