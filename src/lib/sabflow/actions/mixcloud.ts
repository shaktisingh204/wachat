'use server';

export async function executeMixcloudAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://api.mixcloud.com';
  const token = inputs.accessToken;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    switch (actionName) {
      case 'getUser': {
        const username = inputs.username || 'me';
        const res = await fetch(`${baseUrl}/${username}/`, { headers });
        if (!res.ok) return { error: `Mixcloud getUser failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserFeed': {
        const username = inputs.username;
        const res = await fetch(`${baseUrl}/${username}/feed/`, { headers });
        if (!res.ok) return { error: `Mixcloud getUserFeed failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserFollowers': {
        const username = inputs.username;
        const res = await fetch(`${baseUrl}/${username}/followers/`, { headers });
        if (!res.ok) return { error: `Mixcloud getUserFollowers failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserFollowing': {
        const username = inputs.username;
        const res = await fetch(`${baseUrl}/${username}/following/`, { headers });
        if (!res.ok) return { error: `Mixcloud getUserFollowing failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getUserCloudcasts': {
        const username = inputs.username;
        const res = await fetch(`${baseUrl}/${username}/cloudcasts/`, { headers });
        if (!res.ok) return { error: `Mixcloud getUserCloudcasts failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getCloudcast': {
        const username = inputs.username;
        const slug = inputs.slug;
        const res = await fetch(`${baseUrl}/${username}/${slug}/`, { headers });
        if (!res.ok) return { error: `Mixcloud getCloudcast failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getCloudcastComments': {
        const username = inputs.username;
        const slug = inputs.slug;
        const res = await fetch(`${baseUrl}/${username}/${slug}/comments/`, { headers });
        if (!res.ok) return { error: `Mixcloud getCloudcastComments failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'postComment': {
        const username = inputs.username;
        const slug = inputs.slug;
        const comment = inputs.comment;
        const res = await fetch(`${baseUrl}/${username}/${slug}/comments/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ comment }),
        });
        if (!res.ok) return { error: `Mixcloud postComment failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'likeCloudcast': {
        const username = inputs.username;
        const slug = inputs.slug;
        const res = await fetch(`${baseUrl}/${username}/${slug}/favorites/`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) return { error: `Mixcloud likeCloudcast failed: ${res.statusText}` };
        return { output: { success: true } };
      }

      case 'unlikeCloudcast': {
        const username = inputs.username;
        const slug = inputs.slug;
        const res = await fetch(`${baseUrl}/${username}/${slug}/favorites/`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `Mixcloud unlikeCloudcast failed: ${res.statusText}` };
        return { output: { success: true } };
      }

      case 'followUser': {
        const username = inputs.username;
        const targetUser = inputs.targetUser;
        const res = await fetch(`${baseUrl}/${username}/following/${targetUser}/`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) return { error: `Mixcloud followUser failed: ${res.statusText}` };
        return { output: { success: true } };
      }

      case 'unfollowUser': {
        const username = inputs.username;
        const targetUser = inputs.targetUser;
        const res = await fetch(`${baseUrl}/${username}/following/${targetUser}/`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `Mixcloud unfollowUser failed: ${res.statusText}` };
        return { output: { success: true } };
      }

      case 'searchCloudcasts': {
        const query = encodeURIComponent(inputs.query || '');
        const res = await fetch(`${baseUrl}/search/?q=${query}&type=cloudcast`, { headers });
        if (!res.ok) return { error: `Mixcloud searchCloudcasts failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getPopular': {
        const res = await fetch(`${baseUrl}/popular/`, { headers });
        if (!res.ok) return { error: `Mixcloud getPopular failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      case 'getHot': {
        const res = await fetch(`${baseUrl}/hot/`, { headers });
        if (!res.ok) return { error: `Mixcloud getHot failed: ${res.statusText}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Mixcloud action "${actionName}" is not implemented.` };
    }
  } catch (err: any) {
    logger.log(`Mixcloud action error: ${err.message}`);
    return { error: err.message || 'Mixcloud action failed' };
  }
}
