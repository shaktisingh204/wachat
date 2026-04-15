'use server';

const BASE_URL = 'https://api.bunny.net';

export async function executeBunnyCDNAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        if (!apiKey) return { error: 'Missing apiKey in inputs' };

        const headers: Record<string, string> = {
            'AccessKey': apiKey,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listPullZones': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('perPage', String(inputs.perPage));
                const res = await fetch(`${BASE_URL}/pullzone?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getPullZone': {
                if (!inputs.pullZoneId) return { error: 'Missing pullZoneId' };
                const res = await fetch(`${BASE_URL}/pullzone/${inputs.pullZoneId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createPullZone': {
                if (!inputs.name || !inputs.originUrl) return { error: 'Missing name or originUrl' };
                const body: any = { Name: inputs.name, OriginUrl: inputs.originUrl };
                if (inputs.storageZoneId) body.StorageZoneId = inputs.storageZoneId;
                const res = await fetch(`${BASE_URL}/pullzone`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updatePullZone': {
                if (!inputs.pullZoneId) return { error: 'Missing pullZoneId' };
                const body: any = {};
                if (inputs.originUrl) body.OriginUrl = inputs.originUrl;
                if (inputs.name) body.Name = inputs.name;
                if (inputs.cacheExpiration !== undefined) body.CacheExpiration = inputs.cacheExpiration;
                const res = await fetch(`${BASE_URL}/pullzone/${inputs.pullZoneId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deletePullZone': {
                if (!inputs.pullZoneId) return { error: 'Missing pullZoneId' };
                const res = await fetch(`${BASE_URL}/pullzone/${inputs.pullZoneId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'purgeCache': {
                if (!inputs.pullZoneId) return { error: 'Missing pullZoneId' };
                const body: any = {};
                if (inputs.url) body.Url = inputs.url;
                const res = await fetch(`${BASE_URL}/pullzone/${inputs.pullZoneId}/purgeCache`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'listStorageZones': {
                const res = await fetch(`${BASE_URL}/storagezone`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getStorageZone': {
                if (!inputs.storageZoneId) return { error: 'Missing storageZoneId' };
                const res = await fetch(`${BASE_URL}/storagezone/${inputs.storageZoneId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createStorageZone': {
                if (!inputs.name) return { error: 'Missing storage zone name' };
                const body: any = { Name: inputs.name };
                if (inputs.region) body.Region = inputs.region;
                if (inputs.replicationRegions) body.ReplicationRegions = inputs.replicationRegions;
                const res = await fetch(`${BASE_URL}/storagezone`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteStorageZone': {
                if (!inputs.storageZoneId) return { error: 'Missing storageZoneId' };
                const res = await fetch(`${BASE_URL}/storagezone/${inputs.storageZoneId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'listFiles': {
                if (!inputs.storageZoneName) return { error: 'Missing storageZoneName' };
                const path = inputs.path || '/';
                const storageHeaders = { 'AccessKey': apiKey };
                const res = await fetch(`https://storage.bunnycdn.com/${inputs.storageZoneName}${path}`, {
                    headers: storageHeaders,
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getFile': {
                if (!inputs.storageZoneName || !inputs.filePath) return { error: 'Missing storageZoneName or filePath' };
                const storageHeaders = { 'AccessKey': apiKey };
                const res = await fetch(`https://storage.bunnycdn.com/${inputs.storageZoneName}/${inputs.filePath}`, {
                    headers: storageHeaders,
                });
                if (!res.ok) return { error: `Failed to get file: ${res.status}` };
                const buffer = await res.arrayBuffer();
                return { output: { content: Buffer.from(buffer).toString('base64'), contentType: res.headers.get('content-type') } };
            }
            case 'uploadFile': {
                if (!inputs.storageZoneName || !inputs.filePath || !inputs.fileContent) return { error: 'Missing storageZoneName, filePath, or fileContent' };
                const fileBuffer = Buffer.from(inputs.fileContent, 'base64');
                const res = await fetch(`https://storage.bunnycdn.com/${inputs.storageZoneName}/${inputs.filePath}`, {
                    method: 'PUT',
                    headers: { 'AccessKey': apiKey, 'Content-Type': inputs.contentType || 'application/octet-stream' },
                    body: fileBuffer,
                });
                if (res.status === 201) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'deleteFile': {
                if (!inputs.storageZoneName || !inputs.filePath) return { error: 'Missing storageZoneName or filePath' };
                const res = await fetch(`https://storage.bunnycdn.com/${inputs.storageZoneName}/${inputs.filePath}`, {
                    method: 'DELETE',
                    headers: { 'AccessKey': apiKey },
                });
                if (res.status === 200) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'getStatistics': {
                const params = new URLSearchParams();
                if (inputs.pullZoneId) params.set('pullZoneId', String(inputs.pullZoneId));
                if (inputs.dateFrom) params.set('dateFrom', inputs.dateFrom);
                if (inputs.dateTo) params.set('dateTo', inputs.dateTo);
                const res = await fetch(`${BASE_URL}/statistics?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown BunnyCDN action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeBunnyCDNAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in BunnyCDN action' };
    }
}
