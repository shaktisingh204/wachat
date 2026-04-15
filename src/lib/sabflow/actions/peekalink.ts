'use server';

export async function executePeekalinkAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const baseUrl = 'https://api.peekalink.io';
        const headers: Record<string, string> = {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'previewLink': {
                const link = String(inputs.link ?? '').trim();
                if (!link) throw new Error('link is required.');

                logger?.log(`[Peekalink] Previewing link: ${link}`);
                const res = await fetch(`${baseUrl}/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ link }),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.message || data?.error || `Peekalink API error: ${res.status}`);
                return { output: data };
            }

            case 'isSupported': {
                const link = String(inputs.link ?? '').trim();
                if (!link) throw new Error('link is required.');

                logger?.log(`[Peekalink] Checking if supported: ${link}`);
                const res = await fetch(`${baseUrl}/is-supported`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ link }),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.message || data?.error || `Peekalink API error: ${res.status}`);
                return { output: data };
            }

            default:
                return { error: `Peekalink action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Peekalink action failed.' };
    }
}
