'use server';

async function getBlueSkySession(identifier: string, password: string): Promise<{ accessJwt: string; did: string }> {
  const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `BlueSky auth failed: ${res.status}`);
  }
  const data = await res.json();
  return { accessJwt: data.accessJwt, did: data.did };
}

export async function executeBlueskyAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const { accessJwt, did } = await getBlueSkySession(inputs.identifier, inputs.password);
    const pdsUrl = inputs.pdsUrl || 'https://bsky.social';
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessJwt}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'createPost': {
        const record: any = {
          $type: 'app.bsky.feed.post',
          text: inputs.text,
          createdAt: new Date().toISOString(),
        };
        if (inputs.replyRef) record.reply = inputs.replyRef;
        if (inputs.langs) record.langs = Array.isArray(inputs.langs) ? inputs.langs : [inputs.langs];
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', record }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'createPost failed' };
        return { output: { uri: data.uri, cid: data.cid } };
      }

      case 'deletePost': {
        const rkey = inputs.rkey || inputs.uri?.split('/').pop();
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', rkey }),
        });
        if (res.status === 200 || res.status === 204) return { output: { deleted: true, rkey } };
        const data = await res.json().catch(() => ({}));
        return { error: data.message || 'deletePost failed' };
      }

      case 'getPost': {
        const res = await fetch(`${pdsUrl}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(inputs.uri)}&depth=${inputs.depth || 6}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'getPost failed' };
        return { output: { thread: data.thread } };
      }

      case 'likePost': {
        const record = {
          $type: 'app.bsky.feed.like',
          subject: { uri: inputs.uri, cid: inputs.cid },
          createdAt: new Date().toISOString(),
        };
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.like', record }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'likePost failed' };
        return { output: { uri: data.uri, cid: data.cid } };
      }

      case 'unlikePost': {
        const rkey = inputs.likeRkey || inputs.likeUri?.split('/').pop();
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.like', rkey }),
        });
        if (res.status === 200 || res.status === 204) return { output: { unliked: true } };
        const data = await res.json().catch(() => ({}));
        return { error: data.message || 'unlikePost failed' };
      }

      case 'repostPost': {
        const record = {
          $type: 'app.bsky.feed.repost',
          subject: { uri: inputs.uri, cid: inputs.cid },
          createdAt: new Date().toISOString(),
        };
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.repost', record }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'repostPost failed' };
        return { output: { uri: data.uri, cid: data.cid } };
      }

      case 'unrepostPost': {
        const rkey = inputs.repostRkey || inputs.repostUri?.split('/').pop();
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.repost', rkey }),
        });
        if (res.status === 200 || res.status === 204) return { output: { unreposted: true } };
        const data = await res.json().catch(() => ({}));
        return { error: data.message || 'unrepostPost failed' };
      }

      case 'getTimeline': {
        const params = new URLSearchParams({ limit: inputs.limit || '50' });
        if (inputs.cursor) params.set('cursor', inputs.cursor);
        if (inputs.algorithm) params.set('algorithm', inputs.algorithm);
        const res = await fetch(`${pdsUrl}/xrpc/app.bsky.feed.getTimeline?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'getTimeline failed' };
        return { output: { feed: data.feed, cursor: data.cursor } };
      }

      case 'getProfile': {
        const actor = inputs.actor || inputs.handle || did;
        const res = await fetch(`${pdsUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'getProfile failed' };
        return { output: { profile: data } };
      }

      case 'updateProfile': {
        const getRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${did}&collection=app.bsky.actor.profile&rkey=self`, { headers });
        const existing = getRes.ok ? await getRes.json() : { value: {} };
        const record = {
          ...existing.value,
          $type: 'app.bsky.actor.profile',
          displayName: inputs.displayName ?? existing.value?.displayName,
          description: inputs.description ?? existing.value?.description,
        };
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.putRecord`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ repo: did, collection: 'app.bsky.actor.profile', rkey: 'self', record }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'updateProfile failed' };
        return { output: { uri: data.uri, cid: data.cid } };
      }

      case 'follow': {
        const record = {
          $type: 'app.bsky.graph.follow',
          subject: inputs.did || inputs.subject,
          createdAt: new Date().toISOString(),
        };
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ repo: did, collection: 'app.bsky.graph.follow', record }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'follow failed' };
        return { output: { uri: data.uri, cid: data.cid } };
      }

      case 'unfollow': {
        const rkey = inputs.followRkey || inputs.followUri?.split('/').pop();
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ repo: did, collection: 'app.bsky.graph.follow', rkey }),
        });
        if (res.status === 200 || res.status === 204) return { output: { unfollowed: true } };
        const data = await res.json().catch(() => ({}));
        return { error: data.message || 'unfollow failed' };
      }

      case 'listFollowers': {
        const actor = inputs.actor || inputs.handle || did;
        const params = new URLSearchParams({ actor, limit: inputs.limit || '50' });
        if (inputs.cursor) params.set('cursor', inputs.cursor);
        const res = await fetch(`${pdsUrl}/xrpc/app.bsky.graph.getFollowers?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'listFollowers failed' };
        return { output: { followers: data.followers, cursor: data.cursor, subject: data.subject } };
      }

      case 'listFollowing': {
        const actor = inputs.actor || inputs.handle || did;
        const params = new URLSearchParams({ actor, limit: inputs.limit || '50' });
        if (inputs.cursor) params.set('cursor', inputs.cursor);
        const res = await fetch(`${pdsUrl}/xrpc/app.bsky.graph.getFollows?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'listFollowing failed' };
        return { output: { follows: data.follows, cursor: data.cursor, subject: data.subject } };
      }

      case 'searchPosts': {
        const params = new URLSearchParams({
          q: inputs.query,
          limit: inputs.limit || '25',
        });
        if (inputs.cursor) params.set('cursor', inputs.cursor);
        if (inputs.author) params.set('author', inputs.author);
        if (inputs.lang) params.set('lang', inputs.lang);
        const res = await fetch(`${pdsUrl}/xrpc/app.bsky.feed.searchPosts?${params}`, { headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'searchPosts failed' };
        return { output: { posts: data.posts, cursor: data.cursor, hitsTotal: data.hitsTotal } };
      }

      default:
        return { error: `Unknown BlueSky action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`BlueSky error [${actionName}]: ${err.message}`);
    return { error: err.message || 'Unexpected error in BlueSky action' };
  }
}
