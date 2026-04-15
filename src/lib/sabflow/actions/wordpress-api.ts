'use server';

export async function executeWordPressApiAction(
  actionName: string,
  inputs: any,
  user: any,
  logger: any
) {
  try {
    const baseUrl = `${inputs.siteUrl}/wp-json/wp/v2`;
    const credentials = Buffer.from(`${inputs.username}:${inputs.appPassword}`).toString('base64');
    const headers: Record<string, string> = {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listPosts': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/posts?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { posts: data } };
      }

      case 'getPost': {
        const res = await fetch(`${baseUrl}/posts/${inputs.postId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { post: data } };
      }

      case 'createPost': {
        const res = await fetch(`${baseUrl}/posts`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.post),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { post: data } };
      }

      case 'updatePost': {
        const res = await fetch(`${baseUrl}/posts/${inputs.postId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(inputs.post),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { post: data } };
      }

      case 'deletePost': {
        const params = inputs.force ? '?force=true' : '';
        const res = await fetch(`${baseUrl}/posts/${inputs.postId}${params}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { success: true, deleted: data } };
      }

      case 'listPages': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/pages?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { pages: data } };
      }

      case 'getPage': {
        const res = await fetch(`${baseUrl}/pages/${inputs.pageId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { page: data } };
      }

      case 'createPage': {
        const res = await fetch(`${baseUrl}/pages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.page),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { page: data } };
      }

      case 'updatePage': {
        const res = await fetch(`${baseUrl}/pages/${inputs.pageId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(inputs.page),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { page: data } };
      }

      case 'deletePage': {
        const params = inputs.force ? '?force=true' : '';
        const res = await fetch(`${baseUrl}/pages/${inputs.pageId}${params}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { success: true, deleted: data } };
      }

      case 'listMedia': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/media?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { media: data } };
      }

      case 'uploadMedia': {
        const uploadHeaders: Record<string, string> = {
          Authorization: `Basic ${credentials}`,
          'Content-Disposition': `attachment; filename="${inputs.fileName}"`,
          'Content-Type': inputs.mimeType ?? 'application/octet-stream',
        };
        // inputs.fileData should be a base64 string or binary buffer
        const body = inputs.fileData
          ? Buffer.from(inputs.fileData, 'base64')
          : inputs.rawBody;
        const res = await fetch(`${baseUrl}/media`, {
          method: 'POST',
          headers: uploadHeaders,
          body,
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { media: data } };
      }

      case 'listCategories': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/categories?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { categories: data } };
      }

      case 'createCategory': {
        const res = await fetch(`${baseUrl}/categories`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.category),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { category: data } };
      }

      case 'listTags': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/tags?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { tags: data } };
      }

      default:
        return { error: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeWordPressApiAction error: ${err.message}`);
    return { error: err.message ?? 'Unknown error' };
  }
}
