import { DataForSeoTaskResponse } from "./data-for-seo";

// Robust Client with better typing and method structure
const BASE_URL = 'https://api.dataforseo.com/v3';

// Helper for Auth
const getCredentials = () => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    if (!login || !password) throw new Error("DataForSEO Credentials Missing");
    return Buffer.from(`${login}:${password}`).toString('base64');
};

async function post<T>(endpoint: string, payload: any): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${getCredentials()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status_code >= 400 && data.status_code !== 20000) {
        console.error(`DFS Error [${endpoint}]`, data);
        throw new Error(data.status_message || "DataForSEO API Error");
    }
    return data;
}

export class DataForSeoClient {

    // 1. LIVE SERP (Instant check)
    static async getSerpLive(keyword: string, location_code: number = 2840) {
        const payload = [{
            keyword,
            location_code,
            language_code: "en",
            device: "desktop",
            os: "windows",
            depth: 100
        }];
        return post<DataForSeoTaskResponse>('/google/serp/organic/live/advanced', payload);
    }

    // 2. STANDARD SERP TASK (For daily tracking batches)
    static async postSerpTask(keywords: string[], location_code: number = 2840, priority: 1 | 2 = 1) {
        // Priority 1 = High ($0.0012), Priority 2 = Normal ($0.0006)
        const payload = keywords.map(kw => ({
            keyword: kw,
            location_code,
            language_code: "en",
            device: "desktop",
            os: "windows",
            depth: 100,
            priority
        }));

        // Endpoint: /google/serp/organic/task_post
        return post<DataForSeoTaskResponse>('/google/serp/organic/task_post', payload);
    }

    // 3. GET SERP TASK RESULTS (After webhook or polling)
    static async getSerpTaskReady(taskId: string) {
        return post<DataForSeoTaskResponse>(`/google/serp/organic/task_get/${taskId}`, {});
    }

    // 4. KEYWORD DATA (Volume, Difficulty)
    static async getVolumeLive(keywords: string[], location_code: number = 2840) {
        const payload = [{
            keywords,
            location_code,
            language_name: "English"
        }];
        return post<DataForSeoTaskResponse>('/google/keywords_data/google_ads/search_volume/live', payload);
    }
}
