'use server';

const SPOTIFY_BASE = 'https://api.spotify.com/v1';

export async function executeSpotifyAction(
  action: string,
  inputs: Record<string, unknown>
): Promise<{ output?: Record<string, unknown>; error?: string }> {
  const accessToken = inputs.accessToken as string;
  if (!accessToken) return { error: 'Missing accessToken' };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  async function spotifyFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<{ output?: Record<string, unknown>; error?: string }> {
    const url = `${SPOTIFY_BASE}${path}`;
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> || {}) } });
    if (res.status === 204 || res.status === 202) return { output: { success: true } };
    const text = await res.text();
    if (!res.ok) return { error: `Spotify API error ${res.status}: ${text}` };
    try {
      const json = JSON.parse(text);
      return { output: json };
    } catch {
      return { output: { raw: text } };
    }
  }

  switch (action) {
    case 'getCurrentTrack':
      return spotifyFetch('/me/player/currently-playing');

    case 'getRecentTracks':
      return spotifyFetch('/me/player/recently-played?limit=20');

    case 'searchTracks': {
      const query = encodeURIComponent((inputs.query as string) || '');
      const limit = (inputs.limit as number) || 10;
      const type = (inputs.type as string) || 'track';
      return spotifyFetch(`/search?q=${query}&type=${type}&limit=${limit}`);
    }

    case 'getTrack': {
      const trackId = inputs.trackId as string;
      if (!trackId) return { error: 'Missing trackId' };
      return spotifyFetch(`/tracks/${trackId}`);
    }

    case 'getPlaylist': {
      const playlistId = inputs.playlistId as string;
      if (!playlistId) return { error: 'Missing playlistId' };
      return spotifyFetch(`/playlists/${playlistId}`);
    }

    case 'createPlaylist': {
      const userId = inputs.userId as string;
      if (!userId) return { error: 'Missing userId' };
      const body = {
        name: inputs.name as string,
        description: (inputs.description as string) || '',
        public: inputs.isPublic !== undefined ? Boolean(inputs.isPublic) : false,
      };
      return spotifyFetch(`/users/${userId}/playlists`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    case 'addToPlaylist': {
      const playlistId = inputs.playlistId as string;
      if (!playlistId) return { error: 'Missing playlistId' };
      let uris: string[];
      if (Array.isArray(inputs.uris)) {
        uris = inputs.uris as string[];
      } else if (typeof inputs.uris === 'string') {
        try {
          uris = JSON.parse(inputs.uris);
        } catch {
          uris = (inputs.uris as string).split(',').map((u) => u.trim());
        }
      } else {
        return { error: 'Missing uris' };
      }
      return spotifyFetch(`/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris }),
      });
    }

    case 'getAlbum': {
      const albumId = inputs.albumId as string;
      if (!albumId) return { error: 'Missing albumId' };
      return spotifyFetch(`/albums/${albumId}`);
    }

    case 'getArtist': {
      const artistId = inputs.artistId as string;
      if (!artistId) return { error: 'Missing artistId' };
      return spotifyFetch(`/artists/${artistId}`);
    }

    case 'getArtistTopTracks': {
      const artistId = inputs.artistId as string;
      if (!artistId) return { error: 'Missing artistId' };
      const market = (inputs.market as string) || 'US';
      return spotifyFetch(`/artists/${artistId}/top-tracks?market=${market}`);
    }

    case 'getProfile':
      return spotifyFetch('/me');

    case 'pausePlayback':
      return spotifyFetch('/me/player/pause', { method: 'PUT' });

    case 'startPlayback': {
      const body: Record<string, unknown> = {};
      if (inputs.uris) {
        let uris: string[];
        if (Array.isArray(inputs.uris)) {
          uris = inputs.uris as string[];
        } else if (typeof inputs.uris === 'string') {
          try {
            uris = JSON.parse(inputs.uris as string);
          } catch {
            uris = (inputs.uris as string).split(',').map((u) => u.trim());
          }
        } else {
          uris = [];
        }
        body.uris = uris;
      }
      return spotifyFetch('/me/player/play', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    }

    case 'setVolume': {
      const volumePercent = inputs.volumePercent as number;
      if (volumePercent === undefined) return { error: 'Missing volumePercent' };
      return spotifyFetch(`/me/player/volume?volume_percent=${volumePercent}`, { method: 'PUT' });
    }

    case 'skipToNext':
      return spotifyFetch('/me/player/next', { method: 'POST' });

    default:
      return { error: `Unknown action: ${action}` };
  }
}
