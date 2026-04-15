'use server';

export async function executeBandsInTownAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { appId } = inputs;

        if (!appId) return { error: 'BandsInTown: appId is required.' };

        const base = 'https://rest.bandsintown.com';

        async function get(path: string): Promise<any> {
            const res = await fetch(`${base}${path}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || JSON.stringify(data) || `BandsInTown error: ${res.status}`);
            return data;
        }

        logger.log(`Executing BandsInTown action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'getArtist': {
                const { artistName } = inputs;
                if (!artistName) return { error: 'BandsInTown getArtist: artistName is required.' };
                const data = await get(`/artists/${encodeURIComponent(artistName)}?app_id=${encodeURIComponent(appId)}`);
                return { output: data };
            }

            case 'getArtistEvents': {
                const { artistName, date } = inputs;
                if (!artistName) return { error: 'BandsInTown getArtistEvents: artistName is required.' };
                const dateParam = date || 'upcoming';
                const data = await get(`/artists/${encodeURIComponent(artistName)}/events?app_id=${encodeURIComponent(appId)}&date=${encodeURIComponent(dateParam)}`);
                return { output: data };
            }

            case 'getArtistRecommendations': {
                const { artistName } = inputs;
                if (!artistName) return { error: 'BandsInTown getArtistRecommendations: artistName is required.' };
                const data = await get(`/artists/${encodeURIComponent(artistName)}/similar?app_id=${encodeURIComponent(appId)}`);
                return { output: data };
            }

            case 'searchArtists': {
                const { q } = inputs;
                if (!q) return { error: 'BandsInTown searchArtists: q (query) is required.' };
                const data = await get(`/artists?query=${encodeURIComponent(q)}&app_id=${encodeURIComponent(appId)}`);
                return { output: data };
            }

            case 'getVenueEvents': {
                const { venueId } = inputs;
                if (!venueId) return { error: 'BandsInTown getVenueEvents: venueId is required.' };
                const data = await get(`/venues/${encodeURIComponent(venueId)}/events?app_id=${encodeURIComponent(appId)}`);
                return { output: data };
            }

            case 'getEventById': {
                const { id } = inputs;
                if (!id) return { error: 'BandsInTown getEventById: id is required.' };
                const data = await get(`/events/${encodeURIComponent(id)}?app_id=${encodeURIComponent(appId)}`);
                return { output: data };
            }

            case 'getMetro': {
                const { location } = inputs;
                if (!location) return { error: 'BandsInTown getMetro: location is required.' };
                const data = await get(`/metro?location=${encodeURIComponent(location)}&app_id=${encodeURIComponent(appId)}`);
                return { output: data };
            }

            default:
                return { error: `BandsInTown: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`BandsInTown action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'BandsInTown: An unexpected error occurred.' };
    }
}
