'use server';

export async function executeDeezerAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://api.deezer.com';
  const accessToken = inputs.accessToken;

  function buildUrl(path: string, extraParams: Record<string, string> = {}): string {
    const params = new URLSearchParams({ access_token: accessToken, ...extraParams });
    return `${baseUrl}${path}?${params.toString()}`;
  }

  try {
    switch (actionName) {
      case 'getUser': {
        const res = await fetch(buildUrl('/user/me'));
        if (!res.ok) return { error: `Deezer getUser failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserFlow': {
        const res = await fetch(buildUrl('/user/me/flow'));
        if (!res.ok) return { error: `Deezer getUserFlow failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserHistory': {
        const res = await fetch(buildUrl('/user/me/history'));
        if (!res.ok) return { error: `Deezer getUserHistory failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserPlaylists': {
        const userId = inputs.userId || 'me';
        const res = await fetch(buildUrl(`/user/${userId}/playlists`));
        if (!res.ok) return { error: `Deezer getUserPlaylists failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserArtists': {
        const userId = inputs.userId || 'me';
        const res = await fetch(buildUrl(`/user/${userId}/artists`));
        if (!res.ok) return { error: `Deezer getUserArtists failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserAlbums': {
        const userId = inputs.userId || 'me';
        const res = await fetch(buildUrl(`/user/${userId}/albums`));
        if (!res.ok) return { error: `Deezer getUserAlbums failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserTracks': {
        const userId = inputs.userId || 'me';
        const res = await fetch(buildUrl(`/user/${userId}/tracks`));
        if (!res.ok) return { error: `Deezer getUserTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getTrack': {
        const trackId = inputs.trackId;
        const res = await fetch(buildUrl(`/track/${trackId}`));
        if (!res.ok) return { error: `Deezer getTrack failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getAlbum': {
        const albumId = inputs.albumId;
        const res = await fetch(buildUrl(`/album/${albumId}`));
        if (!res.ok) return { error: `Deezer getAlbum failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getArtist': {
        const artistId = inputs.artistId;
        const res = await fetch(buildUrl(`/artist/${artistId}`));
        if (!res.ok) return { error: `Deezer getArtist failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getPlaylist': {
        const playlistId = inputs.playlistId;
        const res = await fetch(buildUrl(`/playlist/${playlistId}`));
        if (!res.ok) return { error: `Deezer getPlaylist failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'searchAll': {
        const query = inputs.query || '';
        const res = await fetch(buildUrl('/search', { q: query }));
        if (!res.ok) return { error: `Deezer searchAll failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'searchTracks': {
        const query = inputs.query || '';
        const res = await fetch(buildUrl('/search/track', { q: query }));
        if (!res.ok) return { error: `Deezer searchTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'searchArtists': {
        const query = inputs.query || '';
        const res = await fetch(buildUrl('/search/artist', { q: query }));
        if (!res.ok) return { error: `Deezer searchArtists failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'searchAlbums': {
        const query = inputs.query || '';
        const res = await fetch(buildUrl('/search/album', { q: query }));
        if (!res.ok) return { error: `Deezer searchAlbums failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Deezer action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Deezer action error: ${err.message}`);
    return { error: err.message || 'Deezer action failed' };
  }
}
