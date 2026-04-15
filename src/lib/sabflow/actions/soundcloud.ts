'use server';

export async function executeSoundCloudAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://api.soundcloud.com';
  const token = inputs.accessToken;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json; charset=utf-8',
  };

  try {
    switch (actionName) {
      case 'getUser': {
        const userId = inputs.userId || 'me';
        const res = await fetch(`${baseUrl}/users/${userId}`, { headers });
        if (!res.ok) return { error: `SoundCloud getUser failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserTracks': {
        const userId = inputs.userId;
        const limit = inputs.limit || 20;
        const res = await fetch(`${baseUrl}/users/${userId}/tracks?limit=${limit}`, { headers });
        if (!res.ok) return { error: `SoundCloud getUserTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserPlaylists': {
        const userId = inputs.userId;
        const res = await fetch(`${baseUrl}/users/${userId}/playlists`, { headers });
        if (!res.ok) return { error: `SoundCloud getUserPlaylists failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserFollowers': {
        const userId = inputs.userId;
        const res = await fetch(`${baseUrl}/users/${userId}/followers`, { headers });
        if (!res.ok) return { error: `SoundCloud getUserFollowers failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserFollowings': {
        const userId = inputs.userId;
        const res = await fetch(`${baseUrl}/users/${userId}/followings`, { headers });
        if (!res.ok) return { error: `SoundCloud getUserFollowings failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getTrack': {
        const trackId = inputs.trackId;
        const res = await fetch(`${baseUrl}/tracks/${trackId}`, { headers });
        if (!res.ok) return { error: `SoundCloud getTrack failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getTracks': {
        const ids = inputs.ids;
        const res = await fetch(`${baseUrl}/tracks?ids=${ids}`, { headers });
        if (!res.ok) return { error: `SoundCloud getTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'createTrack': {
        const formData = new FormData();
        formData.append('track[title]', inputs.title);
        formData.append('track[sharing]', inputs.sharing || 'public');
        if (inputs.description) formData.append('track[description]', inputs.description);
        const createHeaders = { 'Authorization': `Bearer ${token}` };
        const res = await fetch(`${baseUrl}/tracks`, {
          method: 'POST',
          headers: createHeaders,
          body: formData,
        });
        if (!res.ok) return { error: `SoundCloud createTrack failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'updateTrack': {
        const trackId = inputs.trackId;
        const body: any = {};
        if (inputs.title) body['track[title]'] = inputs.title;
        if (inputs.description) body['track[description]'] = inputs.description;
        if (inputs.sharing) body['track[sharing]'] = inputs.sharing;
        const res = await fetch(`${baseUrl}/tracks/${trackId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `SoundCloud updateTrack failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'deleteTrack': {
        const trackId = inputs.trackId;
        const res = await fetch(`${baseUrl}/tracks/${trackId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `SoundCloud deleteTrack failed: ${res.statusText}` };
        return { output: { success: true, trackId } };
      }

      case 'getPlaylist': {
        const playlistId = inputs.playlistId;
        const res = await fetch(`${baseUrl}/playlists/${playlistId}`, { headers });
        if (!res.ok) return { error: `SoundCloud getPlaylist failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'createPlaylist': {
        const payload = {
          playlist: {
            title: inputs.title,
            sharing: inputs.sharing || 'public',
            tracks: inputs.trackIds ? inputs.trackIds.map((id: string) => ({ id })) : [],
          },
        };
        const res = await fetch(`${baseUrl}/playlists`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) return { error: `SoundCloud createPlaylist failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'updatePlaylist': {
        const playlistId = inputs.playlistId;
        const payload: any = { playlist: {} };
        if (inputs.title) payload.playlist.title = inputs.title;
        if (inputs.sharing) payload.playlist.sharing = inputs.sharing;
        if (inputs.trackIds) payload.playlist.tracks = inputs.trackIds.map((id: string) => ({ id }));
        const res = await fetch(`${baseUrl}/playlists/${playlistId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
        if (!res.ok) return { error: `SoundCloud updatePlaylist failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'deletePlaylist': {
        const playlistId = inputs.playlistId;
        const res = await fetch(`${baseUrl}/playlists/${playlistId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `SoundCloud deletePlaylist failed: ${res.statusText}` };
        return { output: { success: true, playlistId } };
      }

      case 'searchTracks': {
        const query = encodeURIComponent(inputs.query || '');
        const limit = inputs.limit || 20;
        const res = await fetch(`${baseUrl}/tracks?q=${query}&limit=${limit}`, { headers });
        if (!res.ok) return { error: `SoundCloud searchTracks failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      default:
        return { error: `SoundCloud action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`SoundCloud action error: ${err.message}`);
    return { error: err.message || 'SoundCloud action failed' };
  }
}
