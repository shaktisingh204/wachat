'use server';

async function getRedditToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'SabNode/1.0',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Reddit OAuth failed: ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error || 'No access token returned');
  return data.access_token;
}

export async function executeRedditEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = 'https://oauth.reddit.com';

  try {
    const token = await getRedditToken(inputs.clientId, inputs.clientSecret);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': inputs.userAgent || 'SabNode/1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

    switch (actionName) {
      case 'getSubreddit': {
        const res = await fetch(`${baseUrl}/r/${inputs.subreddit}/about`, { headers });
        const data = await res.json();
        if (data.error) return { error: data.message || 'getSubreddit failed' };
        return { output: { subreddit: data.data } };
      }

      case 'getPost': {
        const res = await fetch(`${baseUrl}/comments/${inputs.postId}?limit=0`, { headers });
        const data = await res.json();
        if (!Array.isArray(data)) return { error: 'getPost failed: unexpected response' };
        return { output: { post: data[0]?.data?.children?.[0]?.data } };
      }

      case 'createPost': {
        const body = new URLSearchParams({
          sr: inputs.subreddit,
          kind: inputs.kind || 'self',
          title: inputs.title,
          text: inputs.text || '',
          url: inputs.url || '',
          nsfw: inputs.nsfw ? 'true' : 'false',
          spoiler: inputs.spoiler ? 'true' : 'false',
          resubmit: 'true',
        });
        const res = await fetch(`${baseUrl}/api/submit`, {
          method: 'POST',
          headers,
          body: body.toString(),
        });
        const data = await res.json();
        if (data.json?.errors?.length) return { error: data.json.errors[0][1] };
        return { output: { url: data.json?.data?.url, id: data.json?.data?.id, name: data.json?.data?.name } };
      }

      case 'submitPost': {
        const body = new URLSearchParams({
          sr: inputs.subreddit,
          kind: inputs.kind || 'link',
          title: inputs.title,
          url: inputs.url || '',
          text: inputs.text || '',
          resubmit: 'true',
        });
        const res = await fetch(`${baseUrl}/api/submit`, {
          method: 'POST',
          headers,
          body: body.toString(),
        });
        const data = await res.json();
        if (data.json?.errors?.length) return { error: data.json.errors[0][1] };
        return { output: { url: data.json?.data?.url, id: data.json?.data?.id } };
      }

      case 'votePost': {
        const body = new URLSearchParams({
          id: inputs.fullname,
          dir: String(inputs.direction ?? 1),
        });
        const res = await fetch(`${baseUrl}/api/vote`, { method: 'POST', headers, body: body.toString() });
        if (!res.ok) return { error: `votePost failed: ${res.status}` };
        return { output: { voted: true, direction: inputs.direction } };
      }

      case 'savePost': {
        const body = new URLSearchParams({ id: inputs.fullname });
        const endpoint = inputs.unsave ? `${baseUrl}/api/unsave` : `${baseUrl}/api/save`;
        const res = await fetch(endpoint, { method: 'POST', headers, body: body.toString() });
        if (!res.ok) return { error: `savePost failed: ${res.status}` };
        return { output: { saved: !inputs.unsave, id: inputs.fullname } };
      }

      case 'listComments': {
        const params = new URLSearchParams({
          limit: inputs.limit || '25',
          sort: inputs.sort || 'top',
        });
        const res = await fetch(`${baseUrl}/comments/${inputs.postId}?${params}`, { headers });
        const data = await res.json();
        if (!Array.isArray(data)) return { error: 'listComments failed' };
        return { output: { comments: data[1]?.data?.children?.map((c: any) => c.data) } };
      }

      case 'createComment': {
        const body = new URLSearchParams({ parent: inputs.parent, text: inputs.text });
        const res = await fetch(`${baseUrl}/api/comment`, { method: 'POST', headers, body: body.toString() });
        const data = await res.json();
        if (data.json?.errors?.length) return { error: data.json.errors[0][1] };
        return { output: { comment: data.json?.data?.things?.[0]?.data } };
      }

      case 'deleteComment': {
        const body = new URLSearchParams({ id: inputs.fullname });
        const res = await fetch(`${baseUrl}/api/del`, { method: 'POST', headers, body: body.toString() });
        if (!res.ok) return { error: `deleteComment failed: ${res.status}` };
        return { output: { deleted: true, id: inputs.fullname } };
      }

      case 'listSubreddits': {
        const params = new URLSearchParams({ limit: inputs.limit || '25' });
        if (inputs.after) params.set('after', inputs.after);
        const type = inputs.type || 'popular';
        const res = await fetch(`${baseUrl}/subreddits/${type}?${params}`, { headers });
        const data = await res.json();
        if (data.error) return { error: data.message || 'listSubreddits failed' };
        return { output: { subreddits: data.data?.children?.map((c: any) => c.data), after: data.data?.after } };
      }

      case 'searchReddit': {
        const params = new URLSearchParams({
          q: inputs.query,
          limit: inputs.limit || '25',
          sort: inputs.sort || 'relevance',
          type: inputs.type || 'link',
        });
        if (inputs.subreddit) params.set('restrict_sr', 'true');
        const subredditPath = inputs.subreddit ? `/r/${inputs.subreddit}` : '';
        const res = await fetch(`${baseUrl}${subredditPath}/search?${params}`, { headers });
        const data = await res.json();
        if (data.error) return { error: data.message || 'searchReddit failed' };
        return { output: { results: data.data?.children?.map((c: any) => c.data), after: data.data?.after } };
      }

      case 'getUserInfo': {
        const res = await fetch(`${baseUrl}/user/${inputs.username}/about`, { headers });
        const data = await res.json();
        if (data.error) return { error: data.message || 'getUserInfo failed' };
        return { output: { user: data.data } };
      }

      case 'getUserPosts': {
        const params = new URLSearchParams({
          limit: inputs.limit || '25',
          sort: inputs.sort || 'new',
        });
        if (inputs.after) params.set('after', inputs.after);
        const res = await fetch(`${baseUrl}/user/${inputs.username}/submitted?${params}`, { headers });
        const data = await res.json();
        if (data.error) return { error: data.message || 'getUserPosts failed' };
        return { output: { posts: data.data?.children?.map((c: any) => c.data), after: data.data?.after } };
      }

      case 'getHot': {
        const params = new URLSearchParams({ limit: inputs.limit || '25' });
        if (inputs.after) params.set('after', inputs.after);
        const subredditPath = inputs.subreddit ? `/r/${inputs.subreddit}` : '';
        const res = await fetch(`${baseUrl}${subredditPath}/hot?${params}`, { headers });
        const data = await res.json();
        if (data.error) return { error: data.message || 'getHot failed' };
        return { output: { posts: data.data?.children?.map((c: any) => c.data), after: data.data?.after } };
      }

      case 'getNew': {
        const params = new URLSearchParams({ limit: inputs.limit || '25' });
        if (inputs.after) params.set('after', inputs.after);
        const subredditPath = inputs.subreddit ? `/r/${inputs.subreddit}` : '';
        const res = await fetch(`${baseUrl}${subredditPath}/new?${params}`, { headers });
        const data = await res.json();
        if (data.error) return { error: data.message || 'getNew failed' };
        return { output: { posts: data.data?.children?.map((c: any) => c.data), after: data.data?.after } };
      }

      default:
        return { error: `Unknown Reddit Enhanced action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`RedditEnhanced error [${actionName}]: ${err.message}`);
    return { error: err.message || 'Unexpected error in Reddit Enhanced action' };
  }
}
