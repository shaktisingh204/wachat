'use server';

export async function executeGoogleAnalyticsEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const propertyId = String(inputs.propertyId ?? '').trim();
        const BASE = 'https://analyticsdata.googleapis.com/v1beta';
        const ADMIN = 'https://analyticsadmin.googleapis.com/v1beta';

        switch (actionName) {
            case 'runReport': {
                const body = inputs.body ?? {};
                const res = await fetch(`${BASE}/properties/${propertyId}:runReport`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { report: data } };
            }
            case 'batchRunReports': {
                const body = inputs.body ?? {};
                const res = await fetch(`${BASE}/properties/${propertyId}:batchRunReports`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { reports: data } };
            }
            case 'runPivotReport': {
                const body = inputs.body ?? {};
                const res = await fetch(`${BASE}/properties/${propertyId}:runPivotReport`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { pivotReport: data } };
            }
            case 'runRealtimeReport': {
                const body = inputs.body ?? {};
                const res = await fetch(`${BASE}/properties/${propertyId}:runRealtimeReport`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { realtimeReport: data } };
            }
            case 'listProperties': {
                const filter = inputs.filter ? `?filter=${encodeURIComponent(String(inputs.filter))}` : '';
                const res = await fetch(`${ADMIN}/accountSummaries${filter}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { accountSummaries: data } };
            }
            case 'getProperty': {
                const res = await fetch(`${ADMIN}/properties/${propertyId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { property: data } };
            }
            case 'createProperty': {
                const body = inputs.body ?? {};
                const res = await fetch(`${ADMIN}/properties`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { property: data } };
            }
            case 'listAudiences': {
                const res = await fetch(`${ADMIN}/properties/${propertyId}/audiences`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { audiences: data.audiences ?? [] } };
            }
            case 'createAudience': {
                const body = inputs.body ?? {};
                const res = await fetch(`${ADMIN}/properties/${propertyId}/audiences`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { audience: data } };
            }
            case 'listConversionEvents': {
                const res = await fetch(`${ADMIN}/properties/${propertyId}/conversionEvents`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { conversionEvents: data.conversionEvents ?? [] } };
            }
            case 'createConversionEvent': {
                const body = inputs.body ?? {};
                const res = await fetch(`${ADMIN}/properties/${propertyId}/conversionEvents`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { conversionEvent: data } };
            }
            case 'listCustomDimensions': {
                const res = await fetch(`${ADMIN}/properties/${propertyId}/customDimensions`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { customDimensions: data.customDimensions ?? [] } };
            }
            case 'createCustomDimension': {
                const body = inputs.body ?? {};
                const res = await fetch(`${ADMIN}/properties/${propertyId}/customDimensions`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { customDimension: data } };
            }
            case 'runFunnelReport': {
                const body = inputs.body ?? {};
                const res = await fetch(`${BASE}/properties/${propertyId}:runFunnelReport`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { funnelReport: data } };
            }
            case 'checkCompatibility': {
                const body = inputs.body ?? {};
                const res = await fetch(`${BASE}/properties/${propertyId}:checkCompatibility`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { compatibility: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
