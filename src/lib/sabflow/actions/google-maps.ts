'use server';

const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
const DIRECTIONS_BASE = 'https://maps.googleapis.com/maps/api/directions/json';
const DISTANCE_BASE = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const TIMEZONE_BASE = 'https://maps.googleapis.com/maps/api/timezone/json';
const ELEVATION_BASE = 'https://maps.googleapis.com/maps/api/elevation/json';
const ROADS_BASE = 'https://roads.googleapis.com/v1';
const ADDRESS_VALIDATION_BASE = 'https://addressvalidation.googleapis.com/v1:validateAddress';
const ROUTES_BASE = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const AUTOCOMPLETE_BASE = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';

async function gmapsFetch(url: string, logger: any) {
    logger.log(`[GoogleMaps] GET ${url.split('?')[0]}`);
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error_message || data?.message || `Google Maps API error: ${res.status}`);
    if (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) {
        throw new Error(data.error_message || `Google Maps status: ${data.status}`);
    }
    return data;
}

async function gmapsPost(url: string, body: any, apiKey: string, logger: any) {
    logger.log(`[GoogleMaps] POST ${url}`);
    const res = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Google Maps API error: ${res.status}`);
    return data;
}

export async function executeGoogleMapsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'geocodeAddress': {
                const address = String(inputs.address ?? '').trim();
                if (!address) throw new Error('address is required.');
                logger.log(`[GoogleMaps] geocodeAddress: ${address}`);
                const data = await gmapsFetch(`${GEOCODE_BASE}?address=${encodeURIComponent(address)}&key=${apiKey}`, logger);
                const result = data.results?.[0] ?? null;
                return {
                    output: {
                        formattedAddress: result?.formatted_address ?? '',
                        lat: result?.geometry?.location?.lat ?? null,
                        lng: result?.geometry?.location?.lng ?? null,
                        placeId: result?.place_id ?? '',
                        results: data.results ?? [],
                    },
                };
            }

            case 'reverseGeocode': {
                const lat = inputs.lat;
                const lng = inputs.lng ?? inputs.lon;
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lng === undefined || lng === '') throw new Error('lng is required.');
                logger.log(`[GoogleMaps] reverseGeocode: ${lat},${lng}`);
                const data = await gmapsFetch(`${GEOCODE_BASE}?latlng=${lat},${lng}&key=${apiKey}`, logger);
                const result = data.results?.[0] ?? null;
                return {
                    output: {
                        formattedAddress: result?.formatted_address ?? '',
                        placeId: result?.place_id ?? '',
                        results: data.results ?? [],
                    },
                };
            }

            case 'getDirections': {
                const origin = String(inputs.origin ?? '').trim();
                const destination = String(inputs.destination ?? '').trim();
                if (!origin) throw new Error('origin is required.');
                if (!destination) throw new Error('destination is required.');
                const mode = String(inputs.mode ?? 'driving');
                logger.log(`[GoogleMaps] getDirections: ${origin} -> ${destination}`);
                const url = `${DIRECTIONS_BASE}?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}&key=${apiKey}`;
                const data = await gmapsFetch(url, logger);
                const route = data.routes?.[0] ?? null;
                const leg = route?.legs?.[0] ?? null;
                return {
                    output: {
                        distance: leg?.distance?.text ?? '',
                        duration: leg?.duration?.text ?? '',
                        steps: (leg?.steps ?? []).map((s: any) => ({ instruction: s.html_instructions, distance: s.distance?.text })),
                        routes: data.routes ?? [],
                    },
                };
            }

            case 'findNearbyPlaces': {
                const lat = inputs.lat;
                const lng = inputs.lng ?? inputs.lon;
                const radius = Number(inputs.radius ?? 1000);
                const type = inputs.type ? String(inputs.type) : '';
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lng === undefined || lng === '') throw new Error('lng is required.');
                logger.log(`[GoogleMaps] findNearbyPlaces: ${lat},${lng}`);
                let url = `${PLACES_BASE}/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
                if (type) url += `&type=${encodeURIComponent(type)}`;
                const data = await gmapsFetch(url, logger);
                return {
                    output: {
                        results: (data.results ?? []).map((p: any) => ({
                            name: p.name,
                            placeId: p.place_id,
                            address: p.vicinity,
                            rating: p.rating ?? null,
                        })),
                    },
                };
            }

            case 'searchPlaces': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                logger.log(`[GoogleMaps] searchPlaces: ${query}`);
                const url = `${PLACES_BASE}/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
                const data = await gmapsFetch(url, logger);
                return {
                    output: {
                        results: (data.results ?? []).map((p: any) => ({
                            name: p.name,
                            placeId: p.place_id,
                            address: p.formatted_address,
                            rating: p.rating ?? null,
                            lat: p.geometry?.location?.lat ?? null,
                            lng: p.geometry?.location?.lng ?? null,
                        })),
                    },
                };
            }

            case 'getPlaceDetails': {
                const placeId = String(inputs.placeId ?? '').trim();
                if (!placeId) throw new Error('placeId is required.');
                const fields = inputs.fields ? String(inputs.fields) : 'name,formatted_address,rating,website,formatted_phone_number';
                logger.log(`[GoogleMaps] getPlaceDetails: ${placeId}`);
                const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=${encodeURIComponent(fields)}&key=${apiKey}`;
                const data = await gmapsFetch(url, logger);
                return { output: { result: data.result ?? {} } };
            }

            case 'getDistance': {
                const origins = String(inputs.origins ?? '').trim();
                const destinations = String(inputs.destinations ?? '').trim();
                if (!origins) throw new Error('origins is required.');
                if (!destinations) throw new Error('destinations is required.');
                const mode = String(inputs.mode ?? 'driving');
                logger.log(`[GoogleMaps] getDistance`);
                const url = `${DISTANCE_BASE}?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&mode=${mode}&key=${apiKey}`;
                const data = await gmapsFetch(url, logger);
                return { output: { rows: data.rows ?? [], originAddresses: data.origin_addresses ?? [], destinationAddresses: data.destination_addresses ?? [] } };
            }

            case 'getTimezone': {
                const lat = inputs.lat;
                const lng = inputs.lng ?? inputs.lon;
                const timestamp = inputs.timestamp ? Number(inputs.timestamp) : Math.floor(Date.now() / 1000);
                if (lat === undefined || lat === '') throw new Error('lat is required.');
                if (lng === undefined || lng === '') throw new Error('lng is required.');
                logger.log(`[GoogleMaps] getTimezone: ${lat},${lng}`);
                const url = `${TIMEZONE_BASE}?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`;
                const data = await gmapsFetch(url, logger);
                return { output: { timeZoneId: data.timeZoneId ?? '', timeZoneName: data.timeZoneName ?? '', rawOffset: data.rawOffset ?? 0, dstOffset: data.dstOffset ?? 0 } };
            }

            case 'getStaticMap': {
                const center = String(inputs.center ?? '').trim();
                const zoom = Number(inputs.zoom ?? 12);
                const size = String(inputs.size ?? '600x400');
                const maptype = String(inputs.maptype ?? 'roadmap');
                if (!center) throw new Error('center is required.');
                const url = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(center)}&zoom=${zoom}&size=${size}&maptype=${maptype}&key=${apiKey}`;
                logger.log(`[GoogleMaps] getStaticMap`);
                return { output: { mapUrl: url } };
            }

            case 'snapToRoads': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const interpolate = inputs.interpolate !== false;
                logger.log(`[GoogleMaps] snapToRoads`);
                const url = `${ROADS_BASE}/snapToRoads?path=${encodeURIComponent(path)}&interpolate=${interpolate}&key=${apiKey}`;
                const data = await gmapsFetch(url, logger);
                return { output: { snappedPoints: data.snappedPoints ?? [] } };
            }

            case 'getElevation': {
                const locations = String(inputs.locations ?? '').trim();
                if (!locations) throw new Error('locations is required.');
                logger.log(`[GoogleMaps] getElevation`);
                const url = `${ELEVATION_BASE}?locations=${encodeURIComponent(locations)}&key=${apiKey}`;
                const data = await gmapsFetch(url, logger);
                return { output: { results: (data.results ?? []).map((r: any) => ({ elevation: r.elevation, lat: r.location?.lat, lng: r.location?.lng })) } };
            }

            case 'validateAddress': {
                const addressLines = inputs.addressLines ?? [String(inputs.address ?? '').trim()];
                if (!addressLines.length) throw new Error('addressLines is required.');
                logger.log(`[GoogleMaps] validateAddress`);
                const body = { address: { addressLines, regionCode: inputs.regionCode ?? 'US' } };
                const data = await gmapsPost(ADDRESS_VALIDATION_BASE, body, apiKey, logger);
                return { output: { verdict: data.result?.verdict ?? {}, address: data.result?.address ?? {} } };
            }

            case 'autocomplete': {
                const input = String(inputs.input ?? '').trim();
                if (!input) throw new Error('input is required.');
                logger.log(`[GoogleMaps] autocomplete: ${input}`);
                let url = `${AUTOCOMPLETE_BASE}?input=${encodeURIComponent(input)}&key=${apiKey}`;
                if (inputs.types) url += `&types=${encodeURIComponent(String(inputs.types))}`;
                if (inputs.components) url += `&components=${encodeURIComponent(String(inputs.components))}`;
                const data = await gmapsFetch(url, logger);
                return { output: { predictions: (data.predictions ?? []).map((p: any) => ({ description: p.description, placeId: p.place_id })) } };
            }

            case 'getPlacePhoto': {
                const photoReference = String(inputs.photoReference ?? '').trim();
                const maxWidth = Number(inputs.maxWidth ?? 400);
                if (!photoReference) throw new Error('photoReference is required.');
                logger.log(`[GoogleMaps] getPlacePhoto`);
                const url = `${PLACES_BASE}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;
                return { output: { photoUrl: url } };
            }

            case 'getRouteMatrix': {
                const origins = inputs.origins;
                const destinations = inputs.destinations;
                if (!origins) throw new Error('origins is required.');
                if (!destinations) throw new Error('destinations is required.');
                logger.log(`[GoogleMaps] getRouteMatrix`);
                const body = {
                    origins: Array.isArray(origins) ? origins : [origins],
                    destinations: Array.isArray(destinations) ? destinations : [destinations],
                    travelMode: inputs.travelMode ?? 'DRIVE',
                };
                const data = await gmapsPost(ROUTES_BASE, body, apiKey, logger);
                return { output: { matrix: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Unknown Google Maps action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[GoogleMaps] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Google Maps action.' };
    }
}
