'use server';

const SPOTIFY_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com/api/token';

export async function executeSpotifyEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const spotifyFetch = async (method: string, path: string, body?: any, token?: string) => {
            const accessToken = token || inputs.accessToken;
            const url = path.startsWith('http') ? path : `${SPOTIFY_BASE}${path}`;
            logger?.log(`[SpotifyEnhanced] ${method} ${url}`);
            const opts: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(url, opts);
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let json: any;
            try { json = JSON.parse(text); } catch { json = { raw: text }; }
            if (!res.ok) throw new Error(json?.error?.message || json?.error || text);
            return json;
        };

        switch (actionName) {
            case 'getToken': {
                // Client Credentials Flow
                const credentials = Buffer.from(`${inputs.clientId}:${inputs.clientSecret}`).toString('base64');
                const res = await fetch(SPOTIFY_ACCOUNTS, {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: 'grant_type=client_credentials',
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error_description || data?.error || 'Failed to get Spotify token');
                return { output: { accessToken: data.access_token, expiresIn: data.expires_in, tokenType: data.token_type } };
            }
            case 'getProfile': {
                const data = await spotifyFetch('GET', '/me');
                return { output: { profile: data, raw: data } };
            }
            case 'searchTracks': {
                const params = new URLSearchParams({ q: inputs.query, type: 'track', limit: String(inputs.limit || 20) });
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const data = await spotifyFetch('GET', `/search?${params}`);
                return { output: { tracks: data.tracks?.items, total: data.tracks?.total, raw: data } };
            }
            case 'searchArtists': {
                const params = new URLSearchParams({ q: inputs.query, type: 'artist', limit: String(inputs.limit || 20) });
                const data = await spotifyFetch('GET', `/search?${params}`);
                return { output: { artists: data.artists?.items, total: data.artists?.total, raw: data } };
            }
            case 'getTrack': {
                const data = await spotifyFetch('GET', `/tracks/${encodeURIComponent(inputs.trackId)}`);
                return { output: { track: data, raw: data } };
            }
            case 'getArtist': {
                const data = await spotifyFetch('GET', `/artists/${encodeURIComponent(inputs.artistId)}`);
                return { output: { artist: data, raw: data } };
            }
            case 'getAlbum': {
                const data = await spotifyFetch('GET', `/albums/${encodeURIComponent(inputs.albumId)}`);
                return { output: { album: data, raw: data } };
            }
            case 'getPlaylist': {
                const params = new URLSearchParams();
                if (inputs.fields) params.set('fields', inputs.fields);
                const qs = params.toString() ? `?${params}` : '';
                const data = await spotifyFetch('GET', `/playlists/${encodeURIComponent(inputs.playlistId)}${qs}`);
                return { output: { playlist: data, raw: data } };
            }
            case 'createPlaylist': {
                const userId = inputs.userId || 'me';
                const data = await spotifyFetch('POST', `/users/${encodeURIComponent(userId)}/playlists`, {
                    name: inputs.name,
                    description: inputs.description || '',
                    public: inputs.public ?? false,
                    collaborative: inputs.collaborative ?? false,
                });
                return { output: { playlist: data, raw: data } };
            }
            case 'addToPlaylist': {
                const uris: string[] = inputs.uris || (inputs.trackUri ? [inputs.trackUri] : []);
                const data = await spotifyFetch('POST', `/playlists/${encodeURIComponent(inputs.playlistId)}/tracks`, {
                    uris,
                    position: inputs.position,
                });
                return { output: { snapshotId: data.snapshot_id, raw: data } };
            }
            case 'removeFromPlaylist': {
                const tracks = (inputs.uris as string[]).map((uri: string) => ({ uri }));
                const data = await spotifyFetch('DELETE', `/playlists/${encodeURIComponent(inputs.playlistId)}/tracks`, { tracks });
                return { output: { snapshotId: data.snapshot_id, raw: data } };
            }
            case 'getCurrentlyPlaying': {
                const data = await spotifyFetch('GET', '/me/player/currently-playing');
                return { output: { isPlaying: data.is_playing, track: data.item, progressMs: data.progress_ms, raw: data } };
            }
            case 'getRecentlyPlayed': {
                const params = new URLSearchParams({ limit: String(inputs.limit || 20) });
                if (inputs.before) params.set('before', String(inputs.before));
                if (inputs.after) params.set('after', String(inputs.after));
                const data = await spotifyFetch('GET', `/me/player/recently-played?${params}`);
                return { output: { items: data.items, cursors: data.cursors, raw: data } };
            }
            case 'getTopTracks': {
                const params = new URLSearchParams({ time_range: inputs.timeRange || 'medium_term', limit: String(inputs.limit || 20) });
                const data = await spotifyFetch('GET', `/me/top/tracks?${params}`);
                return { output: { tracks: data.items, total: data.total, raw: data } };
            }
            case 'getTopArtists': {
                const params = new URLSearchParams({ time_range: inputs.timeRange || 'medium_term', limit: String(inputs.limit || 20) });
                const data = await spotifyFetch('GET', `/me/top/artists?${params}`);
                return { output: { artists: data.items, total: data.total, raw: data } };
            }
            case 'getRecommendations': {
                const params = new URLSearchParams({ limit: String(inputs.limit || 20) });
                if (inputs.seedArtists) params.set('seed_artists', inputs.seedArtists);
                if (inputs.seedTracks) params.set('seed_tracks', inputs.seedTracks);
                if (inputs.seedGenres) params.set('seed_genres', inputs.seedGenres);
                if (inputs.targetEnergy) params.set('target_energy', String(inputs.targetEnergy));
                if (inputs.targetValence) params.set('target_valence', String(inputs.targetValence));
                const data = await spotifyFetch('GET', `/recommendations?${params}`);
                return { output: { tracks: data.tracks, seeds: data.seeds, raw: data } };
            }
            default:
                return { error: `SpotifyEnhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger?.log(`[SpotifyEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'SpotifyEnhanced action failed' };
    }
}
