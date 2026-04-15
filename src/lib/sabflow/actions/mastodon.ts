'use server';

export async function executeMastodonAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = `${inputs.instanceUrl}/api/v1`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${inputs.accessToken}`,
    'Content-Type': 'application/json',
  };

  try {
    switch (actionName) {
      case 'publishStatus': {
        const res = await fetch(`${baseUrl}/statuses`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            status: inputs.status,
            in_reply_to_id: inputs.inReplyToId,
            media_ids: inputs.mediaIds,
            sensitive: inputs.sensitive || false,
            spoiler_text: inputs.spoilerText,
            visibility: inputs.visibility || 'public',
            language: inputs.language,
            scheduled_at: inputs.scheduledAt,
          }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'publishStatus failed' };
        return { output: { id: data.id, url: data.url, content: data.content, visibility: data.visibility } };
      }

      case 'getStatus': {
        const res = await fetch(`${baseUrl}/statuses/${inputs.statusId}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'getStatus failed' };
        return { output: { status: data } };
      }

      case 'deleteStatus': {
        const res = await fetch(`${baseUrl}/statuses/${inputs.statusId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'deleteStatus failed' };
        return { output: { deleted: true, id: inputs.statusId } };
      }

      case 'boostStatus': {
        const res = await fetch(`${baseUrl}/statuses/${inputs.statusId}/reblog`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ visibility: inputs.visibility || 'public' }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'boostStatus failed' };
        return { output: { id: data.id, reblog: data.reblog?.id } };
      }

      case 'unboostStatus': {
        const res = await fetch(`${baseUrl}/statuses/${inputs.statusId}/unreblog`, { method: 'POST', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'unboostStatus failed' };
        return { output: { unboosted: true, id: data.id } };
      }

      case 'favouriteStatus': {
        const res = await fetch(`${baseUrl}/statuses/${inputs.statusId}/favourite`, { method: 'POST', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'favouriteStatus failed' };
        return { output: { id: data.id, favourited: data.favourited } };
      }

      case 'unfavouriteStatus': {
        const res = await fetch(`${baseUrl}/statuses/${inputs.statusId}/unfavourite`, { method: 'POST', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'unfavouriteStatus failed' };
        return { output: { id: data.id, favourited: data.favourited } };
      }

      case 'listTimeline': {
        const params = new URLSearchParams({
          limit: inputs.limit || '20',
        });
        if (inputs.maxId) params.set('max_id', inputs.maxId);
        if (inputs.sinceId) params.set('since_id', inputs.sinceId);
        if (inputs.local) params.set('local', 'true');
        const timeline = inputs.timeline || 'home';
        const res = await fetch(`${baseUrl}/timelines/${timeline}?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'listTimeline failed' };
        return { output: { statuses: data } };
      }

      case 'listNotifications': {
        const params = new URLSearchParams({ limit: inputs.limit || '20' });
        if (inputs.types) params.set('types[]', inputs.types);
        if (inputs.maxId) params.set('max_id', inputs.maxId);
        const res = await fetch(`${baseUrl}/notifications?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'listNotifications failed' };
        return { output: { notifications: data } };
      }

      case 'getNotification': {
        const res = await fetch(`${baseUrl}/notifications/${inputs.notificationId}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'getNotification failed' };
        return { output: { notification: data } };
      }

      case 'getAccount': {
        const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'getAccount failed' };
        return { output: { account: data } };
      }

      case 'followAccount': {
        const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/follow`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reblogs: inputs.reblogs !== false, notify: inputs.notify || false }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'followAccount failed' };
        return { output: { following: data.following, id: inputs.accountId } };
      }

      case 'unfollowAccount': {
        const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/unfollow`, { method: 'POST', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'unfollowAccount failed' };
        return { output: { following: data.following, id: inputs.accountId } };
      }

      case 'listFollowers': {
        const params = new URLSearchParams({ limit: inputs.limit || '40' });
        if (inputs.maxId) params.set('max_id', inputs.maxId);
        const res = await fetch(`${baseUrl}/accounts/${inputs.accountId}/followers?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'listFollowers failed' };
        return { output: { followers: data } };
      }

      case 'searchContent': {
        const params = new URLSearchParams({
          q: inputs.query,
          limit: inputs.limit || '20',
          type: inputs.type || '',
          resolve: inputs.resolve ? 'true' : 'false',
        });
        if (!inputs.type) params.delete('type');
        const res = await fetch(`${baseUrl}/search?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'searchContent failed' };
        return { output: { accounts: data.accounts, statuses: data.statuses, hashtags: data.hashtags } };
      }

      default:
        return { error: `Unknown Mastodon action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Mastodon error [${actionName}]: ${err.message}`);
    return { error: err.message || 'Unexpected error in Mastodon action' };
  }
}
