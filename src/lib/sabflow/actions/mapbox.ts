'use server';

const MAPBOX_BASE = 'https://api.mapbox.com';

async function mapboxFetch(url: string, accessToken: string, logger: any) {
    const fullUrl = url.includes('?')
        ? `${url}&access_token=${accessToken}`
        : `${url}?access_token=${accessToken}`;
    logger.log(`[Mapbox] GET ${url.split('?')[0]}`);
    const res = await fetch(fullUrl);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Mapbox API error: ${res.status}`);
    return data;
}

async function mapboxPost(url: string, body: any, accessToken: string, logger: any) {
    const fullUrl = `${url}?access_token=${accessToken}`;
    logger.log(`[Mapbox] POST ${url}`);
    const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Mapbox API error: ${res.status}`);
    return data;
}

async function mapboxPut(url: string, body: any, accessToken: string, logger: any) {
    const fullUrl = `${url}?access_token=${accessToken}`;
    logger.log(`[Mapbox] PUT ${url}`);
    const res = await fetch(fullUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Mapbox API error: ${res.status}`);
    return data;
}

async function mapboxDelete(url: string, accessToken: string, logger: any) {
    const fullUrl = `${url}?access_token=${accessToken}`;
    logger.log(`[Mapbox] DELETE ${url}`);
    const res = await fetch(fullUrl, { method: 'DELETE' });
    if (res.status === 204) return { deleted: true };
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Mapbox API error: ${res.status}`);
    return { deleted: true };
}

export async function executeMapboxAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        switch (actionName) {
            case 'geocodeForward': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const country = inputs.country ? `&country=${String(inputs.country)}` : '';
                const limit = inputs.limit ? `&limit=${Number(inputs.limit)}` : '';
                logger.log(`[Mapbox] geocodeForward: ${query}`);
                const url = `${MAPBOX_BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${country}${limit}`;
                const data = await mapboxFetch(url, accessToken, logger);
                return {
                    output: {
                        features: (data.features ?? []).map((f: any) => ({
                            placeName: f.place_name,
                            center: f.center,
                            placeType: f.place_type,
                            id: f.id,
                        })),
                    },
                };
            }

            case 'geocodeReverse': {
                const lng = inputs.lng ?? inputs.lon;
                const lat = inputs.lat;
                if (lng === undefined || lng === '') throw new Error('lng is required.');
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                logger.log(`[Mapbox] geocodeReverse: ${lng},${lat}`);
                const url = `${MAPBOX_BASE}/geocoding/v5/mapbox.places/${lng},${lat}.json`;
                const data = await mapboxFetch(url, accessToken, logger);
                return {
                    output: {
                        features: (data.features ?? []).map((f: any) => ({
                            placeName: f.place_name,
                            placeType: f.place_type,
                        })),
                    },
                };
            }

            case 'getDirections': {
                const coordinates = String(inputs.coordinates ?? '').trim();
                const profile = String(inputs.profile ?? 'driving');
                if (!coordinates) throw new Error('coordinates is required (semicolon-separated lng,lat pairs).');
                logger.log(`[Mapbox] getDirections: profile=${profile}`);
                const url = `${MAPBOX_BASE}/directions/v5/mapbox/${profile}/${encodeURIComponent(coordinates)}?geometries=geojson&steps=true`;
                const data = await mapboxFetch(url, accessToken, logger);
                const route = data.routes?.[0] ?? null;
                return {
                    output: {
                        distance: route?.distance ?? null,
                        duration: route?.duration ?? null,
                        legs: route?.legs ?? [],
                        routes: data.routes ?? [],
                    },
                };
            }

            case 'getMatrix': {
                const coordinates = String(inputs.coordinates ?? '').trim();
                const profile = String(inputs.profile ?? 'driving');
                if (!coordinates) throw new Error('coordinates is required.');
                logger.log(`[Mapbox] getMatrix: profile=${profile}`);
                const url = `${MAPBOX_BASE}/directions-matrix/v1/mapbox/${profile}/${encodeURIComponent(coordinates)}`;
                const data = await mapboxFetch(url, accessToken, logger);
                return { output: { durations: data.durations ?? [], distances: data.distances ?? [], sources: data.sources ?? [], destinations: data.destinations ?? [] } };
            }

            case 'getIsochrone': {
                const profile = String(inputs.profile ?? 'driving');
                const lng = inputs.lng ?? inputs.lon;
                const lat = inputs.lat;
                const contours_minutes = String(inputs.contours_minutes ?? '15,30,45');
                if (lng === undefined || lng === '') throw new Error('lng is required.');
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                logger.log(`[Mapbox] getIsochrone: ${lng},${lat}`);
                const url = `${MAPBOX_BASE}/isochrone/v1/mapbox/${profile}/${lng},${lat}?contours_minutes=${contours_minutes}&polygons=true`;
                const data = await mapboxFetch(url, accessToken, logger);
                return { output: { features: data.features ?? [] } };
            }

            case 'searchPlaces': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const proximity = inputs.proximity ? `&proximity=${String(inputs.proximity)}` : '';
                logger.log(`[Mapbox] searchPlaces: ${query}`);
                const url = `${MAPBOX_BASE}/search/searchbox/v1/forward?q=${encodeURIComponent(query)}${proximity}`;
                const data = await mapboxFetch(url, accessToken, logger);
                return { output: { features: data.features ?? [] } };
            }

            case 'retrievePlace': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                logger.log(`[Mapbox] retrievePlace: ${id}`);
                const url = `${MAPBOX_BASE}/search/searchbox/v1/retrieve/${id}`;
                const data = await mapboxFetch(url, accessToken, logger);
                return { output: { features: data.features ?? [] } };
            }

            case 'listStyles': {
                const username = String(inputs.username ?? '').trim();
                if (!username) throw new Error('username is required.');
                logger.log(`[Mapbox] listStyles: ${username}`);
                const url = `${MAPBOX_BASE}/styles/v1/${username}`;
                const data = await mapboxFetch(url, accessToken, logger);
                return { output: { styles: Array.isArray(data) ? data : [] } };
            }

            case 'getStyle': {
                const username = String(inputs.username ?? '').trim();
                const styleId = String(inputs.styleId ?? '').trim();
                if (!username) throw new Error('username is required.');
                if (!styleId) throw new Error('styleId is required.');
                logger.log(`[Mapbox] getStyle: ${username}/${styleId}`);
                const url = `${MAPBOX_BASE}/styles/v1/${username}/${styleId}`;
                const data = await mapboxFetch(url, accessToken, logger);
                return { output: { style: data } };
            }

            case 'createStyle': {
                const username = String(inputs.username ?? '').trim();
                const style = inputs.style;
                if (!username) throw new Error('username is required.');
                if (!style) throw new Error('style (GeoJSON style object) is required.');
                logger.log(`[Mapbox] createStyle: ${username}`);
                const url = `${MAPBOX_BASE}/styles/v1/${username}`;
                const data = await mapboxPost(url, style, accessToken, logger);
                return { output: { id: data.id, name: data.name, owner: data.owner } };
            }

            case 'updateStyle': {
                const username = String(inputs.username ?? '').trim();
                const styleId = String(inputs.styleId ?? '').trim();
                const style = inputs.style;
                if (!username) throw new Error('username is required.');
                if (!styleId) throw new Error('styleId is required.');
                if (!style) throw new Error('style is required.');
                logger.log(`[Mapbox] updateStyle: ${username}/${styleId}`);
                const url = `${MAPBOX_BASE}/styles/v1/${username}/${styleId}`;
                const data = await mapboxPut(url, style, accessToken, logger);
                return { output: { id: data.id, name: data.name, modified: data.modified } };
            }

            case 'deleteStyle': {
                const username = String(inputs.username ?? '').trim();
                const styleId = String(inputs.styleId ?? '').trim();
                if (!username) throw new Error('username is required.');
                if (!styleId) throw new Error('styleId is required.');
                logger.log(`[Mapbox] deleteStyle: ${username}/${styleId}`);
                const url = `${MAPBOX_BASE}/styles/v1/${username}/${styleId}`;
                const result = await mapboxDelete(url, accessToken, logger);
                return { output: result };
            }

            case 'uploadTileset': {
                const username = String(inputs.username ?? '').trim();
                const tilesetId = String(inputs.tilesetId ?? '').trim();
                if (!username) throw new Error('username is required.');
                if (!tilesetId) throw new Error('tilesetId is required.');
                logger.log(`[Mapbox] uploadTileset: ${username}.${tilesetId}`);
                // Return upload credentials URL — actual binary upload requires separate handling
                const url = `${MAPBOX_BASE}/uploads/v1/${username}`;
                const body = { tileset: `${username}.${tilesetId}`, name: inputs.name ?? tilesetId };
                const data = await mapboxPost(url, body, accessToken, logger);
                return { output: { id: data.id, complete: data.complete ?? false, tileset: data.tileset } };
            }

            case 'getTileset': {
                const username = String(inputs.username ?? '').trim();
                const tilesetId = String(inputs.tilesetId ?? '').trim();
                if (!username) throw new Error('username is required.');
                if (!tilesetId) throw new Error('tilesetId is required.');
                logger.log(`[Mapbox] getTileset: ${username}.${tilesetId}`);
                const url = `${MAPBOX_BASE}/tilesets/v1/${username}.${tilesetId}`;
                const data = await mapboxFetch(url, accessToken, logger);
                return { output: { id: data.id, name: data.name, status: data.status, created: data.created } };
            }

            case 'getTilesetStatus': {
                const username = String(inputs.username ?? '').trim();
                const tilesetId = String(inputs.tilesetId ?? '').trim();
                if (!username) throw new Error('username is required.');
                if (!tilesetId) throw new Error('tilesetId is required.');
                logger.log(`[Mapbox] getTilesetStatus: ${username}.${tilesetId}`);
                const url = `${MAPBOX_BASE}/tilesets/v1/${username}.${tilesetId}/jobs`;
                const data = await mapboxFetch(url, accessToken, logger);
                return { output: { jobs: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Unknown Mapbox action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[Mapbox] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Mapbox action.' };
    }
}
