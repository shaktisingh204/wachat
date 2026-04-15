'use server';

export async function executeLastFmAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://ws.audioscrobbler.com/2.0';
  const apiKey = inputs.apiKey;

  function buildUrl(method: string, extraParams: Record<string, string> = {}): string {
    const params = new URLSearchParams({
      method,
      api_key: apiKey,
      format: 'json',
      ...extraParams,
    });
    return `${baseUrl}?${params.toString()}`;
  }

  try {
    switch (actionName) {
      case 'getUserInfo': {
        const username = inputs.username;
        const res = await fetch(buildUrl('user.getInfo', { user: username }));
        if (!res.ok) return { error: `Last.fm getUserInfo failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserRecentTracks': {
        const username = inputs.username;
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('user.getRecentTracks', { user: username, limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm getUserRecentTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserTopArtists': {
        const username = inputs.username;
        const period = inputs.period || 'overall';
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('user.getTopArtists', { user: username, period, limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm getUserTopArtists failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserTopTracks': {
        const username = inputs.username;
        const period = inputs.period || 'overall';
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('user.getTopTracks', { user: username, period, limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm getUserTopTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserTopAlbums': {
        const username = inputs.username;
        const period = inputs.period || 'overall';
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('user.getTopAlbums', { user: username, period, limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm getUserTopAlbums failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserLovedTracks': {
        const username = inputs.username;
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('user.getLovedTracks', { user: username, limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm getUserLovedTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getTrackInfo': {
        const artist = inputs.artist;
        const track = inputs.track;
        const res = await fetch(buildUrl('track.getInfo', { artist, track }));
        if (!res.ok) return { error: `Last.fm getTrackInfo failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getArtistInfo': {
        const artist = inputs.artist;
        const res = await fetch(buildUrl('artist.getInfo', { artist }));
        if (!res.ok) return { error: `Last.fm getArtistInfo failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getAlbumInfo': {
        const artist = inputs.artist;
        const album = inputs.album;
        const res = await fetch(buildUrl('album.getInfo', { artist, album }));
        if (!res.ok) return { error: `Last.fm getAlbumInfo failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getTopTracks': {
        const country = inputs.country || '';
        const limit = inputs.limit || '10';
        const params: Record<string, string> = { limit: String(limit) };
        if (country) params.country = country;
        const res = await fetch(buildUrl('chart.getTopTracks', params));
        if (!res.ok) return { error: `Last.fm getTopTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getTopArtists': {
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('chart.getTopArtists', { limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm getTopArtists failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'searchTracks': {
        const track = inputs.track;
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('track.search', { track, limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm searchTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'searchArtists': {
        const artist = inputs.artist;
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('artist.search', { artist, limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm searchArtists failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getSimilarTracks': {
        const artist = inputs.artist;
        const track = inputs.track;
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('track.getSimilar', { artist, track, limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm getSimilarTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getSimilarArtists': {
        const artist = inputs.artist;
        const limit = inputs.limit || '10';
        const res = await fetch(buildUrl('artist.getSimilar', { artist, limit: String(limit) }));
        if (!res.ok) return { error: `Last.fm getSimilarArtists failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Last.fm action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Last.fm action error: ${err.message}`);
    return { error: err.message || 'Last.fm action failed' };
  }
}
