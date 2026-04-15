'use server';

export async function executeGoogleAnalytics4Action(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, propertyId, instance } = inputs;
    const baseUrl = 'https://analyticsdata.googleapis.com/v1beta';
    const adminBaseUrl = 'https://analyticsadmin.googleapis.com/v1alpha';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'runReport': {
                const res = await fetch(`${baseUrl}/properties/${propertyId}:runReport`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'runReport failed' };
                return { output: data };
            }

            case 'runRealtimeReport': {
                const res = await fetch(`${baseUrl}/properties/${propertyId}:runRealtimeReport`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'runRealtimeReport failed' };
                return { output: data };
            }

            case 'runFunnelReport': {
                const res = await fetch(`${baseUrl}/properties/${propertyId}:runFunnelReport`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'runFunnelReport failed' };
                return { output: data };
            }

            case 'runPivotReport': {
                const res = await fetch(`${baseUrl}/properties/${propertyId}:runPivotReport`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'runPivotReport failed' };
                return { output: data };
            }

            case 'batchRunReports': {
                const res = await fetch(`${baseUrl}/properties/${propertyId}:batchRunReports`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'batchRunReports failed' };
                return { output: data };
            }

            case 'getMetadata': {
                const res = await fetch(`${baseUrl}/properties/${propertyId}/metadata`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getMetadata failed' };
                return { output: data };
            }

            case 'checkCompatibility': {
                const res = await fetch(`${baseUrl}/properties/${propertyId}:checkCompatibility`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'checkCompatibility failed' };
                return { output: data };
            }

            case 'listProperties': {
                const params = new URLSearchParams({ filter: inputs.filter || '', pageSize: inputs.pageSize || '50' });
                const res = await fetch(`${adminBaseUrl}/properties?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listProperties failed' };
                return { output: data };
            }

            case 'getProperty': {
                const res = await fetch(`${adminBaseUrl}/properties/${propertyId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getProperty failed' };
                return { output: data };
            }

            case 'listDataStreams': {
                const res = await fetch(`${adminBaseUrl}/properties/${propertyId}/dataStreams`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listDataStreams failed' };
                return { output: data };
            }

            case 'getDataStream': {
                const res = await fetch(`${adminBaseUrl}/properties/${propertyId}/dataStreams/${inputs.dataStreamId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getDataStream failed' };
                return { output: data };
            }

            case 'createAudience': {
                const res = await fetch(`${adminBaseUrl}/properties/${propertyId}/audiences`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createAudience failed' };
                return { output: data };
            }

            case 'listAudiences': {
                const res = await fetch(`${adminBaseUrl}/properties/${propertyId}/audiences`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listAudiences failed' };
                return { output: data };
            }

            case 'getAudienceExport': {
                const res = await fetch(`${baseUrl}/properties/${propertyId}/audienceExports/${inputs.audienceExportId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getAudienceExport failed' };
                return { output: data };
            }

            case 'runAccessReport': {
                const res = await fetch(`${baseUrl}/properties/${propertyId}:runAccessReport`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'runAccessReport failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`google-analytics4 error: ${err.message}`);
        return { error: err.message || 'Unexpected error in google-analytics4 action' };
    }
}
