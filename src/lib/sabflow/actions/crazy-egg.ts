'use server';

export async function executeCrazyEggAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const email = String(inputs.email ?? '').trim();
        const BASE = 'https://app.crazyegg.com/api';
        const authHeader = apiKey
            ? `Bearer ${apiKey}`
            : `Basic ${Buffer.from(`${email}:${apiKey}`).toString('base64')}`;

        switch (actionName) {
            case 'listSnapshots': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.perPage) params.append('per_page', String(inputs.perPage));
                const res = await fetch(`${BASE}/snapshots?${params.toString()}`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { snapshots: data.snapshots ?? data } };
            }
            case 'getSnapshot': {
                const snapshotId = String(inputs.snapshotId ?? '').trim();
                const res = await fetch(`${BASE}/snapshots/${snapshotId}`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { snapshot: data } };
            }
            case 'createSnapshot': {
                const body = {
                    url: String(inputs.url ?? '').trim(),
                    name: inputs.name ?? '',
                    device_type: inputs.deviceType ?? 'desktop',
                };
                const res = await fetch(`${BASE}/snapshots`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { snapshot: data } };
            }
            case 'deleteSnapshot': {
                const snapshotId = String(inputs.snapshotId ?? '').trim();
                const res = await fetch(`${BASE}/snapshots/${snapshotId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { deleted: true, snapshotId } };
            }
            case 'listPages': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                const res = await fetch(`${BASE}/pages?${params.toString()}`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { pages: data.pages ?? data } };
            }
            case 'getPage': {
                const pageId = String(inputs.pageId ?? '').trim();
                const res = await fetch(`${BASE}/pages/${pageId}`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { page: data } };
            }
            case 'listHeatmaps': {
                const snapshotId = String(inputs.snapshotId ?? '').trim();
                const res = await fetch(`${BASE}/snapshots/${snapshotId}/heatmaps`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { heatmaps: data.heatmaps ?? data } };
            }
            case 'getHeatmap': {
                const snapshotId = String(inputs.snapshotId ?? '').trim();
                const heatmapId = String(inputs.heatmapId ?? '').trim();
                const res = await fetch(`${BASE}/snapshots/${snapshotId}/heatmaps/${heatmapId}`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { heatmap: data } };
            }
            case 'getConfettiReport': {
                const snapshotId = String(inputs.snapshotId ?? '').trim();
                const res = await fetch(`${BASE}/snapshots/${snapshotId}/confetti`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { confetti: data } };
            }
            case 'getScrollReport': {
                const snapshotId = String(inputs.snapshotId ?? '').trim();
                const res = await fetch(`${BASE}/snapshots/${snapshotId}/scroll`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { scroll: data } };
            }
            case 'listOverlays': {
                const snapshotId = String(inputs.snapshotId ?? '').trim();
                const res = await fetch(`${BASE}/snapshots/${snapshotId}/overlays`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { overlays: data.overlays ?? data } };
            }
            case 'getOverlay': {
                const snapshotId = String(inputs.snapshotId ?? '').trim();
                const overlayId = String(inputs.overlayId ?? '').trim();
                const res = await fetch(`${BASE}/snapshots/${snapshotId}/overlays/${overlayId}`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { overlay: data } };
            }
            case 'listSegments': {
                const res = await fetch(`${BASE}/segments`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { segments: data.segments ?? data } };
            }
            case 'createSegment': {
                const body = {
                    name: String(inputs.name ?? '').trim(),
                    conditions: inputs.conditions ?? [],
                };
                const res = await fetch(`${BASE}/segments`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { segment: data } };
            }
            case 'getAnalytics': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.append('start_date', String(inputs.startDate));
                if (inputs.endDate) params.append('end_date', String(inputs.endDate));
                const res = await fetch(`${BASE}/analytics?${params.toString()}`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { analytics: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
