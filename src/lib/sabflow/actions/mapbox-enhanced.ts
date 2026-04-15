'use server';

const BASE_URL = 'https://api.mapbox.com';

export async function executeMapboxEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        if (!accessToken) return { error: 'Missing required credential: accessToken' };

        const apiFetch = async (url: string, method = 'GET', body?: any) => {
            const separator = url.includes('?') ? '&' : '?';
            const fullUrl = `${url}${separator}access_token=${accessToken}`;
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
            case 'geocodeForward': {
                const searchText = encodeURIComponent(inputs.searchText || '');
                const params = new URLSearchParams();
                if (inputs.country) params.set('country', inputs.country);
                if (inputs.proximity) params.set('proximity', inputs.proximity);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`${BASE_URL}/geocoding/v5/mapbox.places/${searchText}.json${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'geocodeReverse': {
                const longitude = inputs.longitude;
                const latitude = inputs.latitude;
                const params = new URLSearchParams();
                if (inputs.types) params.set('types', inputs.types);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`${BASE_URL}/geocoding/v5/mapbox.places/${longitude},${latitude}.json${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getDirections': {
                const profile = inputs.profile || 'mapbox/driving';
                const coordinates = inputs.coordinates; // semicolon-separated "lng,lat" pairs
                const params = new URLSearchParams();
                if (inputs.alternatives !== undefined) params.set('alternatives', String(inputs.alternatives));
                if (inputs.geometries) params.set('geometries', inputs.geometries);
                if (inputs.steps !== undefined) params.set('steps', String(inputs.steps));
                if (inputs.overview) params.set('overview', inputs.overview);
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`${BASE_URL}/directions/v5/${profile}/${coordinates}${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getMatrix': {
                const profile = inputs.profile || 'mapbox/driving';
                const coordinates = inputs.coordinates;
                const params = new URLSearchParams();
                if (inputs.sources) params.set('sources', inputs.sources);
                if (inputs.destinations) params.set('destinations', inputs.destinations);
                if (inputs.annotations) params.set('annotations', inputs.annotations);
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`${BASE_URL}/directions-matrix/v1/${profile}/${coordinates}${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getOptimization': {
                const profile = inputs.profile || 'mapbox/driving';
                const coordinates = inputs.coordinates;
                const params = new URLSearchParams();
                if (inputs.roundtrip !== undefined) params.set('roundtrip', String(inputs.roundtrip));
                if (inputs.source) params.set('source', inputs.source);
                if (inputs.destination) params.set('destination', inputs.destination);
                if (inputs.geometries) params.set('geometries', inputs.geometries);
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`${BASE_URL}/optimized-trips/v1/${profile}/${coordinates}${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getIsochrone': {
                const profile = inputs.profile || 'mapbox/driving';
                const longitude = inputs.longitude;
                const latitude = inputs.latitude;
                const contours = inputs.contours || '5,10,15'; // minutes
                const params = new URLSearchParams({ contours_minutes: contours });
                if (inputs.polygons !== undefined) params.set('polygons', String(inputs.polygons));
                if (inputs.denoise) params.set('denoise', String(inputs.denoise));
                const data = await apiFetch(`${BASE_URL}/isochrone/v1/${profile}/${longitude},${latitude}?${params}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getStaticMap': {
                const username = inputs.username || 'mapbox';
                const style = inputs.style || 'streets-v12';
                const longitude = inputs.longitude;
                const latitude = inputs.latitude;
                const zoom = inputs.zoom || 12;
                const width = inputs.width || 600;
                const height = inputs.height || 400;
                const url = `${BASE_URL}/styles/v1/${username}/${style}/static/${longitude},${latitude},${zoom}/${width}x${height}?access_token=${accessToken}`;
                return { output: { staticMapUrl: url, longitude, latitude, zoom, width, height } };
            }

            case 'getTilesets': {
                const ownerId = inputs.ownerId;
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`${BASE_URL}/tilesets/v1/${ownerId}${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'listStylesheets': {
                const username = inputs.username;
                const params = new URLSearchParams();
                if (inputs.draft !== undefined) params.set('draft', String(inputs.draft));
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`${BASE_URL}/styles/v1/${username}${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getStylesheet': {
                const username = inputs.username;
                const styleId = inputs.styleId;
                const data = await apiFetch(`${BASE_URL}/styles/v1/${username}/${styleId}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'createDataset': {
                const username = inputs.username;
                const body = {
                    name: inputs.name,
                    description: inputs.description || '',
                };
                const data = await apiFetch(`${BASE_URL}/datasets/v1/${username}`, 'POST', body);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'listDatasets': {
                const username = inputs.username;
                const data = await apiFetch(`${BASE_URL}/datasets/v1/${username}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getDatasetFeatures': {
                const username = inputs.username;
                const datasetId = inputs.datasetId;
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`${BASE_URL}/datasets/v1/${username}/${datasetId}/features${query}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'uploadFile': {
                const username = inputs.username;
                const params = new URLSearchParams();
                if (inputs.name) params.set('name', inputs.name);
                const query = params.toString() ? `?${params}` : '';
                const data = await apiFetch(`${BASE_URL}/uploads/v1/${username}${query}`, 'POST', inputs.uploadRequest || {});
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getElevation': {
                const longitude = inputs.longitude;
                const latitude = inputs.latitude;
                const data = await apiFetch(`${BASE_URL}/v4/mapbox.mapbox-terrain-dem-v1/tilequery/${longitude},${latitude}.json`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            default:
                return { error: `Unknown Mapbox Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Mapbox Enhanced action error: ${err.message}`);
        return { error: err.message || 'Mapbox Enhanced action failed' };
    }
}
