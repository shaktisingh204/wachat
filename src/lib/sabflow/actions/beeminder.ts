
'use server';

const BM_BASE = 'https://www.beeminder.com/api/v1';

async function bmFetch(
    method: string,
    path: string,
    authToken: string,
    body?: Record<string, any>,
    logger?: any,
): Promise<any> {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${BM_BASE}${path}${separator}auth_token=${authToken}`;
    logger?.log(`[Beeminder] ${method} ${path}`);
    const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.errors?.message || data?.error || `Beeminder API error: ${res.status}`);
    return data;
}

export async function executeBeeminderAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const authToken = String(inputs.authToken ?? '').trim();
        if (!authToken) throw new Error('authToken is required.');
        const username = String(inputs.username ?? '').trim();

        const call = (method: string, path: string, body?: Record<string, any>) =>
            bmFetch(method, path, authToken, body, logger);

        switch (actionName) {
            case 'getUser': {
                const uname = String(inputs.username2 ?? inputs.username ?? '').trim();
                if (!uname) throw new Error('username is required.');
                const data = await call('GET', `/users/${uname}.json`);
                return {
                    output: {
                        username: data.username,
                        goals: data.goals ?? [],
                        timezone: data.timezone,
                        updatedAt: data.updated_at,
                    },
                };
            }

            case 'listGoals': {
                if (!username) throw new Error('username is required.');
                const data = await call('GET', `/users/${username}/goals.json`);
                const goals = (Array.isArray(data) ? data : []).map((g: any) => ({
                    slug: g.slug,
                    title: g.title,
                    goalVal: g.goalval,
                    safeSum: g.safesum,
                    delta: g.delta,
                    deadline: g.deadline,
                    loseDate: g.losedate,
                    thumbUrl: g.thumb_url,
                    graphUrl: g.graph_url,
                }));
                return { output: { goals } };
            }

            case 'getGoal': {
                const goalSlug = String(inputs.goalSlug ?? '').trim();
                if (!goalSlug) throw new Error('goalSlug is required.');
                if (!username) throw new Error('username is required.');
                const data = await call('GET', `/users/${username}/goals/${goalSlug}.json`);
                return {
                    output: {
                        slug: data.slug,
                        title: data.title,
                        goalVal: data.goalval,
                        safeSum: data.safesum,
                        delta: data.delta,
                        deadline: data.deadline,
                        loseDate: data.losedate,
                        lastDatapoint: data.last_datapoint ?? {},
                        graphUrl: data.graph_url,
                    },
                };
            }

            case 'createGoal': {
                if (!username) throw new Error('username is required.');
                const slug = String(inputs.slug ?? '').trim();
                if (!slug) throw new Error('slug is required.');
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const goalType = String(inputs.goalType ?? '').trim();
                if (!goalType) throw new Error('goalType is required.');
                if (inputs.goalDate === undefined || inputs.goalDate === '') throw new Error('goalDate is required.');
                if (inputs.goalVal === undefined || inputs.goalVal === '') throw new Error('goalVal is required.');
                if (inputs.rate === undefined || inputs.rate === '') throw new Error('rate is required.');
                const body = {
                    slug,
                    title,
                    goal_type: goalType,
                    goaldate: inputs.goalDate,
                    goalval: inputs.goalVal,
                    rate: inputs.rate,
                    dry_run: inputs.dryRun ?? false,
                };
                const data = await call('POST', `/users/${username}/goals.json`, body);
                return { output: { id: data.id, slug: data.slug, title: data.title } };
            }

            case 'updateGoal': {
                if (!username) throw new Error('username is required.');
                const goalSlug = String(inputs.goalSlug ?? '').trim();
                if (!goalSlug) throw new Error('goalSlug is required.');
                if (!inputs.data || typeof inputs.data !== 'object') throw new Error('data (object) is required.');
                const data = await call('PUT', `/users/${username}/goals/${goalSlug}.json`, inputs.data);
                return { output: { slug: data.slug } };
            }

            case 'addDatapoint': {
                if (!username) throw new Error('username is required.');
                const goalSlug = String(inputs.goalSlug ?? '').trim();
                if (!goalSlug) throw new Error('goalSlug is required.');
                if (inputs.value === undefined || inputs.value === '') throw new Error('value is required.');
                const body: Record<string, any> = {
                    value: inputs.value,
                    comment: inputs.comment ?? '',
                    timestamp: inputs.timestamp ?? Math.floor(Date.now() / 1000),
                };
                if (inputs.requestid !== undefined) body.requestid = inputs.requestid;
                const data = await call('POST', `/users/${username}/goals/${goalSlug}/datapoints.json`, body);
                return {
                    output: {
                        id: data.id,
                        value: data.value,
                        timestamp: data.timestamp,
                        comment: data.comment,
                    },
                };
            }

            case 'addDatapoints': {
                if (!username) throw new Error('username is required.');
                const goalSlug = String(inputs.goalSlug ?? '').trim();
                if (!goalSlug) throw new Error('goalSlug is required.');
                if (!Array.isArray(inputs.datapoints) || inputs.datapoints.length === 0) {
                    throw new Error('datapoints (array) is required.');
                }
                const data = await call('POST', `/users/${username}/goals/${goalSlug}/datapoints/create_all.json`, { datapoints: inputs.datapoints });
                return { output: { datapoints: data ?? [] } };
            }

            case 'getDatapoints': {
                if (!username) throw new Error('username is required.');
                const goalSlug = String(inputs.goalSlug ?? '').trim();
                if (!goalSlug) throw new Error('goalSlug is required.');
                const sort = inputs.sort ?? 'id';
                const count = inputs.count ?? 25;
                const page = inputs.page ?? 1;
                const data = await call('GET', `/users/${username}/goals/${goalSlug}/datapoints.json?sort=${sort}&count=${count}&page=${page}`);
                return { output: { datapoints: Array.isArray(data) ? data : [] } };
            }

            case 'updateDatapoint': {
                if (!username) throw new Error('username is required.');
                const goalSlug = String(inputs.goalSlug ?? '').trim();
                if (!goalSlug) throw new Error('goalSlug is required.');
                const datapointId = inputs.datapointId;
                if (!datapointId) throw new Error('datapointId is required.');
                const body: Record<string, any> = {};
                if (inputs.value !== undefined) body.value = inputs.value;
                if (inputs.comment !== undefined) body.comment = inputs.comment;
                const data = await call('PUT', `/users/${username}/goals/${goalSlug}/datapoints/${datapointId}.json`, body);
                return { output: { id: data.id, value: data.value } };
            }

            case 'deleteDatapoint': {
                if (!username) throw new Error('username is required.');
                const goalSlug = String(inputs.goalSlug ?? '').trim();
                if (!goalSlug) throw new Error('goalSlug is required.');
                const datapointId = inputs.datapointId;
                if (!datapointId) throw new Error('datapointId is required.');
                const data = await call('DELETE', `/users/${username}/goals/${goalSlug}/datapoints/${datapointId}.json`);
                return { output: { id: data.id, value: data.value } };
            }

            case 'archiveGoal': {
                if (!username) throw new Error('username is required.');
                const goalSlug = String(inputs.goalSlug ?? '').trim();
                if (!goalSlug) throw new Error('goalSlug is required.');
                const data = await call('POST', `/users/${username}/goals/${goalSlug}/stop_caring.json`);
                return { output: { slug: data.slug } };
            }

            case 'listContracts': {
                if (!username) throw new Error('username is required.');
                const data = await call('GET', `/users/${username}/contracts.json`);
                return { output: { contracts: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Beeminder action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Beeminder action failed.' };
    }
}
