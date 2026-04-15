
'use server';

const SEGMENT_TRACK_BASE = 'https://api.segment.io/v1';
const SEGMENT_PUBLIC_BASE = 'https://api.segmentapis.com';

async function segmentTrackFetch(
    writeKey: string,
    path: string,
    body: any,
    logger: any,
) {
    const auth = Buffer.from(`${writeKey}:`).toString('base64');
    logger.log(`[Segment] POST ${SEGMENT_TRACK_BASE}${path}`);
    const res = await fetch(`${SEGMENT_TRACK_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.message || `Segment Track API error: ${res.status}`);
    return data;
}

async function segmentPublicFetch(
    token: string,
    method: string,
    path: string,
    logger: any,
    params?: Record<string, string>,
) {
    const url = new URL(`${SEGMENT_PUBLIC_BASE}${path}`);
    if (params) {
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, v); });
    }
    logger.log(`[Segment Public API] ${method} ${url.toString()}`);
    const res = await fetch(url.toString(), {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.message || data?.error || `Segment Public API error: ${res.status}`);
    return data;
}

export async function executeSegmentAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const timestamp = new Date().toISOString();

        // ── Tracking API actions (require writeKey) ──────────────────────────
        const trackingActions = new Set([
            'identify', 'track', 'page', 'screen', 'group', 'alias', 'batch', 'import',
        ]);

        if (trackingActions.has(actionName)) {
            const writeKey = String(inputs.writeKey ?? '').trim();
            if (!writeKey) throw new Error('writeKey is required.');

            switch (actionName) {
                case 'identify': {
                    const userId = String(inputs.userId ?? '').trim();
                    if (!userId) throw new Error('userId is required.');
                    const body: any = { userId, timestamp };
                    if (inputs.anonymousId) body.anonymousId = inputs.anonymousId;
                    if (inputs.traits) body.traits = inputs.traits;
                    if (inputs.context) body.context = inputs.context;
                    await segmentTrackFetch(writeKey, '/identify', body, logger);
                    return { output: { success: true } };
                }

                case 'track': {
                    const userId = String(inputs.userId ?? '').trim();
                    const event = String(inputs.event ?? '').trim();
                    if (!userId) throw new Error('userId is required.');
                    if (!event) throw new Error('event is required.');
                    const body: any = { userId, event, timestamp };
                    if (inputs.anonymousId) body.anonymousId = inputs.anonymousId;
                    if (inputs.properties) body.properties = inputs.properties;
                    if (inputs.context) body.context = inputs.context;
                    await segmentTrackFetch(writeKey, '/track', body, logger);
                    return { output: { success: true } };
                }

                case 'page': {
                    const userId = String(inputs.userId ?? '').trim();
                    if (!userId) throw new Error('userId is required.');
                    const body: any = { userId, timestamp };
                    if (inputs.anonymousId) body.anonymousId = inputs.anonymousId;
                    if (inputs.name) body.name = inputs.name;
                    if (inputs.category) body.category = inputs.category;
                    if (inputs.properties) body.properties = inputs.properties;
                    await segmentTrackFetch(writeKey, '/page', body, logger);
                    return { output: { success: true } };
                }

                case 'screen': {
                    const userId = String(inputs.userId ?? '').trim();
                    if (!userId) throw new Error('userId is required.');
                    const body: any = { userId, timestamp };
                    if (inputs.anonymousId) body.anonymousId = inputs.anonymousId;
                    if (inputs.name) body.name = inputs.name;
                    if (inputs.properties) body.properties = inputs.properties;
                    await segmentTrackFetch(writeKey, '/screen', body, logger);
                    return { output: { success: true } };
                }

                case 'group': {
                    const userId = String(inputs.userId ?? '').trim();
                    const groupId = String(inputs.groupId ?? '').trim();
                    if (!userId) throw new Error('userId is required.');
                    if (!groupId) throw new Error('groupId is required.');
                    const body: any = { userId, groupId, timestamp };
                    if (inputs.traits) body.traits = inputs.traits;
                    await segmentTrackFetch(writeKey, '/group', body, logger);
                    return { output: { success: true } };
                }

                case 'alias': {
                    const userId = String(inputs.userId ?? '').trim();
                    const previousId = String(inputs.previousId ?? '').trim();
                    if (!userId) throw new Error('userId is required.');
                    if (!previousId) throw new Error('previousId is required.');
                    await segmentTrackFetch(writeKey, '/alias', { userId, previousId, timestamp }, logger);
                    return { output: { success: true } };
                }

                case 'batch': {
                    const batch = inputs.batch;
                    if (!Array.isArray(batch) || batch.length === 0) throw new Error('batch must be a non-empty array of events.');
                    await segmentTrackFetch(writeKey, '/batch', { batch, timestamp }, logger);
                    return { output: { success: true } };
                }

                case 'import': {
                    const events = inputs.events;
                    if (!Array.isArray(events) || events.length === 0) throw new Error('events must be a non-empty array.');
                    await segmentTrackFetch(writeKey, '/import', { batch: events }, logger);
                    return { output: { success: true } };
                }

                default:
                    return { error: `Segment action "${actionName}" is not implemented.` };
            }
        }

        // ── Public API actions (require publicApiToken) ───────────────────────
        const publicApiToken = String(inputs.publicApiToken ?? '').trim();
        if (!publicApiToken) throw new Error('publicApiToken is required.');

        const pub = (method: string, path: string, params?: Record<string, string>) =>
            segmentPublicFetch(publicApiToken, method, path, logger, params);

        switch (actionName) {
            case 'listSources': {
                const data = await pub('GET', '/sources');
                return { output: { data: { sources: data?.data?.sources ?? [] } } };
            }

            case 'getSource': {
                const sourceId = String(inputs.sourceId ?? '').trim();
                if (!sourceId) throw new Error('sourceId is required.');
                const data = await pub('GET', `/sources/${sourceId}`);
                return { output: { data: { source: data?.data?.source ?? {} } } };
            }

            case 'listTrackingPlans': {
                const data = await pub('GET', '/tracking-plans');
                return { output: { data: { trackingPlans: data?.data?.trackingPlans ?? [] } } };
            }

            case 'listDestinations': {
                const data = await pub('GET', '/destinations');
                return { output: { data: { destinations: data?.data?.destinations ?? [] } } };
            }

            case 'getWorkspace': {
                const data = await pub('GET', '/workspaces');
                return { output: { data: { workspace: data?.data?.workspace ?? {} } } };
            }

            case 'listProfiles': {
                const spaceId = String(inputs.spaceId ?? '').trim();
                if (!spaceId) throw new Error('spaceId is required.');
                const params: Record<string, string> = {};
                if (inputs.limit !== undefined) params.limit = String(inputs.limit);
                if (inputs.cursor) params.cursor = String(inputs.cursor);
                const data = await pub('GET', `/spaces/${spaceId}/profiles`, params);
                return { output: { data: data?.data ?? {} } };
            }

            default:
                return { error: `Segment action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Segment action failed.' };
    }
}
