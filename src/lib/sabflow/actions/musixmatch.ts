'use server';

export async function executeMusixmatchAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://api.musixmatch.com/ws/1.1';
  const apiKey = inputs.apiKey;

  function buildUrl(endpoint: string, extraParams: Record<string, string> = {}): string {
    const params = new URLSearchParams({ apikey: apiKey, ...extraParams });
    return `${baseUrl}/${endpoint}?${params.toString()}`;
  }

  try {
    switch (actionName) {
      case 'matcherLyricsGet': {
        const params: Record<string, string> = {};
        if (inputs.qTrack) params.q_track = inputs.qTrack;
        if (inputs.qArtist) params.q_artist = inputs.qArtist;
        const res = await fetch(buildUrl('matcher.lyrics.get', params));
        if (!res.ok) return { error: `Musixmatch matcherLyricsGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'matcherTrackGet': {
        const params: Record<string, string> = {};
        if (inputs.qTrack) params.q_track = inputs.qTrack;
        if (inputs.qArtist) params.q_artist = inputs.qArtist;
        const res = await fetch(buildUrl('matcher.track.get', params));
        if (!res.ok) return { error: `Musixmatch matcherTrackGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'trackGet': {
        const trackId = inputs.trackId;
        const res = await fetch(buildUrl('track.get', { track_id: String(trackId) }));
        if (!res.ok) return { error: `Musixmatch trackGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'trackSearch': {
        const params: Record<string, string> = {};
        if (inputs.qTrack) params.q_track = inputs.qTrack;
        if (inputs.qArtist) params.q_artist = inputs.qArtist;
        if (inputs.qLyrics) params.q_lyrics = inputs.qLyrics;
        if (inputs.pageSize) params.page_size = String(inputs.pageSize);
        if (inputs.page) params.page = String(inputs.page);
        const res = await fetch(buildUrl('track.search', params));
        if (!res.ok) return { error: `Musixmatch trackSearch failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'trackLyricsGet': {
        const trackId = inputs.trackId;
        const res = await fetch(buildUrl('track.lyrics.get', { track_id: String(trackId) }));
        if (!res.ok) return { error: `Musixmatch trackLyricsGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'trackLyricsPost': {
        const trackId = inputs.trackId;
        const lyricsBody = inputs.lyricsBody;
        const params = new URLSearchParams({
          apikey: apiKey,
          track_id: String(trackId),
          lyrics_body: lyricsBody,
        });
        const res = await fetch(`${baseUrl}/track.lyrics.post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        if (!res.ok) return { error: `Musixmatch trackLyricsPost failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'trackLyricsMoodGet': {
        const trackId = inputs.trackId;
        const res = await fetch(buildUrl('track.lyrics.mood.get', { track_id: String(trackId) }));
        if (!res.ok) return { error: `Musixmatch trackLyricsMoodGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'trackSnippetGet': {
        const trackId = inputs.trackId;
        const res = await fetch(buildUrl('track.snippet.get', { track_id: String(trackId) }));
        if (!res.ok) return { error: `Musixmatch trackSnippetGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'trackSubtitleGet': {
        const trackId = inputs.trackId;
        const params: Record<string, string> = { track_id: String(trackId) };
        if (inputs.subtitleFormat) params.subtitle_format = inputs.subtitleFormat;
        const res = await fetch(buildUrl('track.subtitle.get', params));
        if (!res.ok) return { error: `Musixmatch trackSubtitleGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'albumGet': {
        const albumId = inputs.albumId;
        const res = await fetch(buildUrl('album.get', { album_id: String(albumId) }));
        if (!res.ok) return { error: `Musixmatch albumGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'albumTracksGet': {
        const albumId = inputs.albumId;
        const pageSize = inputs.pageSize || '10';
        const page = inputs.page || '1';
        const res = await fetch(buildUrl('album.tracks.get', {
          album_id: String(albumId),
          page_size: String(pageSize),
          page: String(page),
        }));
        if (!res.ok) return { error: `Musixmatch albumTracksGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'artistGet': {
        const artistId = inputs.artistId;
        const res = await fetch(buildUrl('artist.get', { artist_id: String(artistId) }));
        if (!res.ok) return { error: `Musixmatch artistGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'artistSearch': {
        const qArtist = inputs.qArtist;
        const pageSize = inputs.pageSize || '10';
        const page = inputs.page || '1';
        const res = await fetch(buildUrl('artist.search', {
          q_artist: qArtist,
          page_size: String(pageSize),
          page: String(page),
        }));
        if (!res.ok) return { error: `Musixmatch artistSearch failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'artistAlbumsGet': {
        const artistId = inputs.artistId;
        const pageSize = inputs.pageSize || '10';
        const page = inputs.page || '1';
        const res = await fetch(buildUrl('artist.albums.get', {
          artist_id: String(artistId),
          page_size: String(pageSize),
          page: String(page),
          s_release_date: inputs.sortByReleaseDate || 'desc',
        }));
        if (!res.ok) return { error: `Musixmatch artistAlbumsGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'chartArtistsGet': {
        const country = inputs.country || 'us';
        const pageSize = inputs.pageSize || '10';
        const page = inputs.page || '1';
        const res = await fetch(buildUrl('chart.artists.get', {
          country,
          page_size: String(pageSize),
          page: String(page),
        }));
        if (!res.ok) return { error: `Musixmatch chartArtistsGet failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Musixmatch action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Musixmatch action error: ${err.message}`);
    return { error: err.message || 'Musixmatch action failed' };
  }
}
