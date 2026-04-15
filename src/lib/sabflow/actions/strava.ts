'use server';

async function stravaFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Strava] ${method} ${path}`);
    const BASE = 'https://www.strava.com/api/v3';
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message ?? data?.errors?.[0]?.field ?? `Strava API error: ${res.status}`);
    }
    return data;
}

export async function executeStravaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const sv = (method: string, path: string, body?: any) =>
            stravaFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getAthlete': {
                const data = await sv('GET', '/athlete');
                return {
                    output: {
                        id: String(data.id ?? ''),
                        firstname: data.firstname ?? '',
                        lastname: data.lastname ?? '',
                        city: data.city ?? '',
                        country: data.country ?? '',
                        followers: String(data.follower_count ?? data.followers ?? 0),
                        following: String(data.friend_count ?? data.following ?? 0),
                        premium: String(data.premium ?? data.summit ?? false),
                    },
                };
            }

            case 'getAthleteStats': {
                const athleteId = String(inputs.athleteId ?? '').trim();
                if (!athleteId) throw new Error('athleteId is required.');
                const data = await sv('GET', `/athletes/${athleteId}/stats`);
                return {
                    output: {
                        recentRunTotals: data.recent_run_totals ?? {},
                        ytdRunTotals: data.ytd_run_totals ?? {},
                        allRunTotals: data.all_run_totals ?? {},
                    },
                };
            }

            case 'listActivities': {
                const params = new URLSearchParams();
                if (inputs.before) params.set('before', String(inputs.before));
                if (inputs.after) params.set('after', String(inputs.after));
                if (inputs.page) params.set('page', String(inputs.page));
                params.set('per_page', String(inputs.perPage ?? 30));
                const data = await sv('GET', `/athlete/activities?${params.toString()}`);
                const activities = (Array.isArray(data) ? data : []).map((a: any) => ({
                    id: String(a.id ?? ''),
                    name: a.name ?? '',
                    type: a.type ?? '',
                    distance: String(a.distance ?? 0),
                    movingTime: String(a.moving_time ?? 0),
                    startDate: a.start_date ?? '',
                }));
                return { output: { activities } };
            }

            case 'getActivity': {
                const activityId = String(inputs.activityId ?? '').trim();
                if (!activityId) throw new Error('activityId is required.');
                const data = await sv('GET', `/activities/${activityId}`);
                return {
                    output: {
                        id: String(data.id ?? activityId),
                        name: data.name ?? '',
                        type: data.type ?? '',
                        distance: String(data.distance ?? 0),
                        movingTime: String(data.moving_time ?? 0),
                        totalElevationGain: String(data.total_elevation_gain ?? 0),
                        averageSpeed: String(data.average_speed ?? 0),
                        startDate: data.start_date ?? '',
                    },
                };
            }

            case 'createActivity': {
                const name = String(inputs.name ?? '').trim();
                const type = String(inputs.type ?? '').trim();
                const startDateLocal = String(inputs.startDateLocal ?? '').trim();
                const elapsedTime = inputs.elapsedTime;
                if (!name) throw new Error('name is required.');
                if (!type) throw new Error('type is required.');
                if (!startDateLocal) throw new Error('startDateLocal is required.');
                if (elapsedTime === undefined) throw new Error('elapsedTime is required.');
                const body: Record<string, any> = {
                    name,
                    type,
                    start_date_local: startDateLocal,
                    elapsed_time: Number(elapsedTime),
                };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.distance !== undefined) body.distance = Number(inputs.distance);
                const data = await sv('POST', '/activities', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'updateActivity': {
                const activityId = String(inputs.activityId ?? '').trim();
                if (!activityId) throw new Error('activityId is required.');
                const body: Record<string, any> = {};
                if (inputs.name !== undefined) body.name = String(inputs.name);
                if (inputs.type !== undefined) body.type = String(inputs.type);
                if (inputs.description !== undefined) body.description = String(inputs.description);
                body.private = inputs.private === true || inputs.private === 'true' ? true : false;
                body.commute = inputs.commute === true || inputs.commute === 'true' ? true : false;
                const data = await sv('PUT', `/activities/${activityId}`, body);
                return { output: { id: String(data.id ?? activityId) } };
            }

            case 'deleteActivity': {
                const activityId = String(inputs.activityId ?? '').trim();
                if (!activityId) throw new Error('activityId is required.');
                await sv('DELETE', `/activities/${activityId}`);
                return { output: { deleted: true } };
            }

            case 'listClubs': {
                const data = await sv('GET', '/athlete/clubs');
                const clubs = (Array.isArray(data) ? data : []).map((c: any) => ({
                    id: String(c.id ?? ''),
                    name: c.name ?? '',
                    memberCount: String(c.member_count ?? 0),
                }));
                return { output: { clubs } };
            }

            case 'getClub': {
                const clubId = String(inputs.clubId ?? '').trim();
                if (!clubId) throw new Error('clubId is required.');
                const data = await sv('GET', `/clubs/${clubId}`);
                return {
                    output: {
                        id: String(data.id ?? clubId),
                        name: data.name ?? '',
                        memberCount: String(data.member_count ?? 0),
                        description: data.description ?? '',
                    },
                };
            }

            case 'listClubActivities': {
                const clubId = String(inputs.clubId ?? '').trim();
                if (!clubId) throw new Error('clubId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const data = await sv('GET', `/clubs/${clubId}/activities?${params.toString()}`);
                return { output: { activities: Array.isArray(data) ? data : [] } };
            }

            case 'getRoutes': {
                const athleteId = String(inputs.athleteId ?? '').trim();
                if (!athleteId) throw new Error('athleteId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const data = await sv('GET', `/athletes/${athleteId}/routes?${params.toString()}`);
                const routes = (Array.isArray(data) ? data : []).map((r: any) => ({
                    id: String(r.id ?? ''),
                    name: r.name ?? '',
                    distance: String(r.distance ?? 0),
                    elevationGain: String(r.elevation_gain ?? 0),
                }));
                return { output: { routes } };
            }

            case 'listSegments': {
                const bounds = String(inputs.bounds ?? '').trim();
                if (!bounds) throw new Error('bounds is required (e.g. "37.821362,-122.505373,37.842038,-122.465977").');
                const activityType = String(inputs.activityType ?? 'running');
                const data = await sv('GET', `/segments/explore?bounds=${encodeURIComponent(bounds)}&activity_type=${encodeURIComponent(activityType)}`);
                return { output: { segments: data.segments ?? [] } };
            }

            case 'getSegment': {
                const segmentId = String(inputs.segmentId ?? '').trim();
                if (!segmentId) throw new Error('segmentId is required.');
                const data = await sv('GET', `/segments/${segmentId}`);
                return {
                    output: {
                        id: String(data.id ?? segmentId),
                        name: data.name ?? '',
                        distance: String(data.distance ?? 0),
                        averageGrade: String(data.average_grade ?? 0),
                        kom: data.xoms?.kom ?? data.kom ?? '',
                    },
                };
            }

            case 'listGear': {
                // Get the authenticated athlete, then surface shoes and bikes
                const athleteData = await sv('GET', '/athlete');
                const shoes: any[] = athleteData.shoes ?? [];
                const bikes: any[] = athleteData.bikes ?? [];
                const gear = [
                    ...shoes.map((g: any) => ({ ...g, gearType: 'shoe' })),
                    ...bikes.map((g: any) => ({ ...g, gearType: 'bike' })),
                ];
                return { output: { gear } };
            }

            default:
                return { error: `Strava action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger?.log(`[Strava] Error in ${actionName}: ${e.message}`);
        return { error: e.message || 'Strava action failed.' };
    }
}
