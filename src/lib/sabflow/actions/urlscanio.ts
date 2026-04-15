'use server';

export async function executeUrlScanIoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const baseUrl = 'https://urlscan.io/api/v1';

        switch (actionName) {
            case 'submitScan': {
                if (!apiKey) throw new Error('apiKey is required for submitting scans.');
                const url = String(inputs.url ?? '').trim();
                if (!url) throw new Error('url is required.');
                const visibility = String(inputs.visibility ?? 'public').trim();

                logger?.log(`[URLScan.io] Submitting scan for: ${url}`);
                const res = await fetch(`${baseUrl}/scan/`, {
                    method: 'POST',
                    headers: {
                        'API-Key': apiKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ url, visibility }),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.message || data?.description || `URLScan.io API error: ${res.status}`);
                return { output: { uuid: data.uuid, api: data.api, visibility: data.visibility, url: data.url } };
            }

            case 'getResult': {
                const uuid = String(inputs.uuid ?? '').trim();
                if (!uuid) throw new Error('uuid is required.');

                logger?.log(`[URLScan.io] Getting result for: ${uuid}`);
                const res = await fetch(`${baseUrl}/result/${uuid}/`, { method: 'GET' });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.message || `URLScan.io API error: ${res.status}`);
                return { output: data };
            }

            case 'getDom': {
                const uuid = String(inputs.uuid ?? '').trim();
                if (!uuid) throw new Error('uuid is required.');

                logger?.log(`[URLScan.io] Getting DOM for: ${uuid}`);
                const res = await fetch(`${baseUrl}/dom/${uuid}/`, { method: 'GET' });
                if (!res.ok) throw new Error(`URLScan.io API error: ${res.status}`);
                const domContent = await res.text();
                return { output: { dom: domContent } };
            }

            case 'getScreenshot': {
                const uuid = String(inputs.uuid ?? '').trim();
                if (!uuid) throw new Error('uuid is required.');

                const screenshotUrl = `https://urlscan.io/screenshots/${uuid}.png`;
                logger?.log(`[URLScan.io] Screenshot URL for: ${uuid}`);
                return { output: { url: screenshotUrl, uuid } };
            }

            case 'searchScans': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const size = inputs.size ? Number(inputs.size) : 10;

                logger?.log(`[URLScan.io] Searching scans: ${query}`);
                const params = new URLSearchParams({ q: query, size: String(size) });
                const fetchHeaders: Record<string, string> = {};
                if (apiKey) fetchHeaders['API-Key'] = apiKey;

                const res = await fetch(`${baseUrl}/search/?${params.toString()}`, {
                    method: 'GET',
                    headers: fetchHeaders,
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.message || `URLScan.io API error: ${res.status}`);
                return { output: { total: data.total, results: data.results ?? [] } };
            }

            default:
                return { error: `URLScan.io action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'URLScan.io action failed.' };
    }
}
