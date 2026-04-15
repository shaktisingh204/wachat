
'use server';

export async function executeYourlsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '');
        if (!serverUrl) throw new Error('serverUrl is required (e.g. https://yourdomain.com/yourls-api.php).');

        const username = String(inputs.username ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        const signature = String(inputs.signature ?? '').trim();

        if (!signature && (!username || !password)) {
            throw new Error('Either signature or username+password are required.');
        }

        const postYourls = async (fields: Record<string, string>) => {
            const params = new URLSearchParams({ format: 'json', ...fields });

            // Auth: signature takes priority over username/password
            if (signature) {
                params.set('signature', signature);
            } else {
                params.set('username', username);
                params.set('password', password);
            }

            logger?.log(`[YOURLS] POST ${serverUrl} action=${fields.action}`);

            const res = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });

            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }

            if (!res.ok) throw new Error(data?.message || `YOURLS error ${res.status}`);
            if (data?.status === 'fail') throw new Error(data?.message || 'YOURLS request failed');

            return data;
        };

        switch (actionName) {
            case 'shortenUrl': {
                const url = String(inputs.url ?? '').trim();
                if (!url) throw new Error('url is required.');
                const fields: Record<string, string> = { action: 'shorturl', url };
                if (inputs.keyword) fields.keyword = String(inputs.keyword);
                if (inputs.title) fields.title = String(inputs.title);
                const data = await postYourls(fields);
                return { output: { shortUrl: data.shorturl, url: data.url, title: data.title, message: data.message, status: data.status } };
            }

            case 'expandUrl': {
                const shortUrl = String(inputs.shortUrl ?? inputs.url ?? '').trim();
                if (!shortUrl) throw new Error('shortUrl is required.');
                const data = await postYourls({ action: 'expand', shorturl: shortUrl });
                return { output: { shortUrl: data.shorturl, longUrl: data.longurl, title: data.title } };
            }

            case 'getUrlStats': {
                const shortUrl = String(inputs.shortUrl ?? inputs.url ?? '').trim();
                if (!shortUrl) throw new Error('shortUrl is required.');
                const data = await postYourls({ action: 'url-stats', shorturl: shortUrl });
                return { output: data?.link ?? data };
            }

            case 'getDbStats': {
                const data = await postYourls({ action: 'db-stats' });
                return { output: data?.db ?? data };
            }

            case 'getLinks': {
                const limit = String(inputs.limit ?? '10');
                const offset = String(inputs.offset ?? '0');
                const filter = String(inputs.filter ?? 'recent');
                const data = await postYourls({ action: 'getlinks', filter, limit, offset });
                return { output: { links: data?.links ?? data?.result ?? [], stats: data?.stats } };
            }

            case 'deleteUrl': {
                const shortUrl = String(inputs.shortUrl ?? inputs.url ?? '').trim();
                if (!shortUrl) throw new Error('shortUrl is required.');
                const data = await postYourls({ action: 'delete', shorturl: shortUrl });
                return { output: { success: true, message: data?.message, status: data?.statusCode } };
            }

            case 'updateUrl': {
                const shortUrl = String(inputs.shortUrl ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!shortUrl || !url) throw new Error('shortUrl and url are required.');
                const fields: Record<string, string> = { action: 'update', shorturl: shortUrl, url };
                if (inputs.title) fields.title = String(inputs.title);
                const data = await postYourls(fields);
                return { output: { success: true, message: data?.message, status: data?.statusCode } };
            }

            default:
                throw new Error(`Unknown YOURLS action: "${actionName}"`);
        }
    } catch (err: any) {
        logger?.log(`[YOURLS] Error: ${err.message}`);
        return { error: err.message };
    }
}
