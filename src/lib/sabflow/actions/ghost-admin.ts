'use server';

export async function executeGhostAdminAction(
  actionName: string,
  inputs: any,
  user: any,
  logger: any
) {
  try {
    const baseUrl = `https://${inputs.domain}/ghost/api/admin`;

    // JWT generation for Ghost Admin API using Web Crypto (no SDKs)
    async function buildJwt(adminApiKey: string): Promise<string> {
      const [id, secret] = adminApiKey.split(':');
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: 'HS256', typ: 'JWT', kid: id };
      const payload = { iat: now, exp: now + 300, aud: '/admin/' };

      const encode = (obj: object) =>
        Buffer.from(JSON.stringify(obj)).toString('base64url');

      const signingInput = `${encode(header)}.${encode(payload)}`;
      const keyBytes = Buffer.from(secret, 'hex');

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', cryptoKey, Buffer.from(signingInput));
      const sigB64 = Buffer.from(sig).toString('base64url');
      return `${signingInput}.${sigB64}`;
    }

    const token = await buildJwt(inputs.adminApiKey);
    const headers: Record<string, string> = {
      Authorization: `Ghost ${token}`,
      'Content-Type': 'application/json',
      'Accept-Version': 'v5.0',
    };

    switch (actionName) {
      case 'listPosts': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/posts/?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { posts: data.posts, meta: data.meta } };
      }

      case 'getPost': {
        const res = await fetch(`${baseUrl}/posts/${inputs.postId}/`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { post: data.posts?.[0] ?? data } };
      }

      case 'createPost': {
        const res = await fetch(`${baseUrl}/posts/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ posts: [inputs.post] }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { post: data.posts?.[0] } };
      }

      case 'updatePost': {
        const res = await fetch(`${baseUrl}/posts/${inputs.postId}/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ posts: [{ ...inputs.post, updated_at: inputs.updatedAt }] }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { post: data.posts?.[0] } };
      }

      case 'deletePost': {
        const res = await fetch(`${baseUrl}/posts/${inputs.postId}/`, { method: 'DELETE', headers });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, postId: inputs.postId } };
      }

      case 'publishPost': {
        const res = await fetch(`${baseUrl}/posts/${inputs.postId}/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ posts: [{ status: 'published', updated_at: inputs.updatedAt }] }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { post: data.posts?.[0] } };
      }

      case 'listPages': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/pages/?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { pages: data.pages, meta: data.meta } };
      }

      case 'createPage': {
        const res = await fetch(`${baseUrl}/pages/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ pages: [inputs.page] }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { page: data.pages?.[0] } };
      }

      case 'updatePage': {
        const res = await fetch(`${baseUrl}/pages/${inputs.pageId}/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ pages: [{ ...inputs.page, updated_at: inputs.updatedAt }] }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { page: data.pages?.[0] } };
      }

      case 'deletePage': {
        const res = await fetch(`${baseUrl}/pages/${inputs.pageId}/`, { method: 'DELETE', headers });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, pageId: inputs.pageId } };
      }

      case 'listMembers': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/members/?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { members: data.members, meta: data.meta } };
      }

      case 'getMember': {
        const res = await fetch(`${baseUrl}/members/${inputs.memberId}/`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { member: data.members?.[0] ?? data } };
      }

      case 'createMember': {
        const res = await fetch(`${baseUrl}/members/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ members: [inputs.member] }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { member: data.members?.[0] } };
      }

      case 'updateMember': {
        const res = await fetch(`${baseUrl}/members/${inputs.memberId}/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ members: [inputs.member] }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { member: data.members?.[0] } };
      }

      case 'listNewsletters': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/newsletters/?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { newsletters: data.newsletters, meta: data.meta } };
      }

      default:
        return { error: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeGhostAdminAction error: ${err.message}`);
    return { error: err.message ?? 'Unknown error' };
  }
}
