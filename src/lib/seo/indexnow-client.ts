import { nanoid } from 'nanoid';

// IndexNow requires a key hosted at the root (or specified location).
// We will generate a consistent key for the project/env or use a fixed one.
// For this MVP, we use a fixed env var or default.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'wachat-seo-indexnow-key';

export class IndexNowClient {
    static getKey() {
        return INDEXNOW_KEY;
    }

    static async submitToIndexNow(host: string, urlList: string[]) {
        const key = this.getKey();
        // IndexNow Endpoint (Bing is the main receiver and propagates to Yandex)
        const endpoint = 'https://api.indexnow.org/indexnow';

        try {
            const body = {
                host,
                key,
                keyLocation: `https://${host}/${key}.txt`, // We assume users setup this route or file
                urlList
            };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`IndexNow Error: ${res.status} ${text}`);
            }

            return { success: true, count: urlList.length };
        } catch (e: any) {
            console.error("IndexNow Submission Failed", e);
            throw e;
        }
    }
}
