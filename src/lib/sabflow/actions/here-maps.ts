'use server';

export async function executeHereMapsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        if (!apiKey) return { error: 'Missing required credential: apiKey' };

        const apiFetch = async (url: string, method = 'GET', body?: any) => {
            const separator = url.includes('?') ? '&' : '?';
            const fullUrl = `${url}${separator}apikey=${apiKey}`;
            const res = await fetch(fullUrl, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) return { _error: data.message || data.error || `Request failed: ${res.status}` };
            return data;
        };

        switch (actionName) {
            case 'geocode': {
                const address = encodeURIComponent(inputs.address || '');
                const params = new URLSearchParams({ q: inputs.address || '' });
                if (inputs.country) params.set('in', `countryCode:${inputs.country}`);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await apiFetch(`https://geocode.search.hereapi.com/v1/geocode?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'reverseGeocode': {
                const lat = inputs.latitude;
                const lng = inputs.longitude;
                const params = new URLSearchParams({ at: `${lat},${lng}` });
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await apiFetch(`https://revgeocode.search.hereapi.com/v1/revgeocode?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'searchPlaces': {
                const params = new URLSearchParams({ q: inputs.query || '' });
                if (inputs.at) params.set('at', inputs.at);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.lang) params.set('lang', inputs.lang);
                const data = await apiFetch(`https://discover.search.hereapi.com/v1/discover?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getRoute': {
                const origin = inputs.origin; // "lat,lng"
                const destination = inputs.destination;
                const transportMode = inputs.transportMode || 'car';
                const params = new URLSearchParams({
                    origin,
                    destination,
                    transportMode,
                    return: inputs.return || 'summary,polyline',
                });
                const data = await apiFetch(`https://router.hereapi.com/v8/routes?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getMatrix': {
                const origins = inputs.origins || [];
                const destinations = inputs.destinations || [];
                const transportMode = inputs.transportMode || 'car';
                const params = new URLSearchParams({ transportMode, async: 'false' });
                origins.forEach((o: string, i: number) => params.append(`origin[${i}]`, o));
                destinations.forEach((d: string, i: number) => params.append(`destination[${i}]`, d));
                const data = await apiFetch(`https://matrix.router.hereapi.com/v8/matrix?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getIsoline': {
                const origin = inputs.origin;
                const range = inputs.range || '900'; // seconds or meters
                const rangeType = inputs.rangeType || 'time';
                const transportMode = inputs.transportMode || 'car';
                const params = new URLSearchParams({ origin, range, rangeType, transportMode });
                const data = await apiFetch(`https://isoline.router.hereapi.com/v8/isolines?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getWeather': {
                const product = inputs.product || 'observation';
                const latitude = inputs.latitude;
                const longitude = inputs.longitude;
                const params = new URLSearchParams({ product, latitude, longitude });
                if (inputs.oneObservation !== undefined) params.set('oneobservation', String(inputs.oneObservation));
                const data = await apiFetch(`https://weather.ls.hereapi.com/weather/1.0/report.json?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getBrowse': {
                const params = new URLSearchParams();
                if (inputs.at) params.set('at', inputs.at);
                if (inputs.categories) params.set('categories', inputs.categories);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.circle) params.set('in', `circle:${inputs.circle}`);
                const data = await apiFetch(`https://browse.search.hereapi.com/v1/browse?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'discoverPlaces': {
                const params = new URLSearchParams({ q: inputs.query || '' });
                if (inputs.at) params.set('at', inputs.at);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.in) params.set('in', inputs.in);
                const data = await apiFetch(`https://discover.search.hereapi.com/v1/discover?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getAutosuggest': {
                const params = new URLSearchParams({ q: inputs.query || '' });
                if (inputs.at) params.set('at', inputs.at);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.resultTypes) params.set('resultTypes', inputs.resultTypes);
                const data = await apiFetch(`https://autosuggest.search.hereapi.com/v1/autosuggest?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getTrafficFlow': {
                const params = new URLSearchParams();
                if (inputs.bbox) params.set('bbox', inputs.bbox);
                if (inputs.corridor) params.set('corridor', inputs.corridor);
                if (inputs.responseattributes) params.set('responseattributes', inputs.responseattributes);
                const data = await apiFetch(`https://data.traffic.hereapi.com/traffic/6.3/flow.json?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getTrafficIncidents': {
                const params = new URLSearchParams();
                if (inputs.bbox) params.set('bbox', inputs.bbox);
                if (inputs.corridor) params.set('corridor', inputs.corridor);
                if (inputs.criticality) params.set('criticality', inputs.criticality);
                if (inputs.startTime) params.set('startTime', inputs.startTime);
                const data = await apiFetch(`https://data.traffic.hereapi.com/traffic/6.3/incidents.json?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getLookup': {
                const id = inputs.id;
                const params = new URLSearchParams({ id });
                if (inputs.lang) params.set('lang', inputs.lang);
                const data = await apiFetch(`https://lookup.search.hereapi.com/v1/lookup?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getMapTile': {
                const scheme = inputs.scheme || 'normal.map';
                const zoom = inputs.zoom || 12;
                const col = inputs.col || 0;
                const row = inputs.row || 0;
                const format = inputs.format || 'png8';
                const tileUrl = `https://maps.ls.hereapi.com/maptile/2.1/maptile/newest/${scheme}/${zoom}/${col}/${row}/256/${format}?apikey=${apiKey}`;
                return { output: { tileUrl, scheme, zoom, col, row, format } };
            }

            case 'calculateTollCost': {
                const params = new URLSearchParams({
                    waypoint0: inputs.origin,
                    waypoint1: inputs.destination,
                    mode: inputs.mode || 'fastest;car;traffic:disabled',
                    currency: inputs.currency || 'USD',
                });
                if (inputs.vehicleType) params.set('vehicleType', inputs.vehicleType);
                const data = await apiFetch(`https://tce.api.here.com/2/calculateroute.json?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            default:
                return { error: `Unknown HERE Maps action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`HERE Maps action error: ${err.message}`);
        return { error: err.message || 'HERE Maps action failed' };
    }
}
