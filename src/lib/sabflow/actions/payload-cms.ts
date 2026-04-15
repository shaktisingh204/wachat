'use server';

export async function executePayloadCMSAction(
  actionName: string,
  inputs: any,
  user: any,
  logger: any
): Promise<{ output?: any; error?: string }> {
  try {
    const baseUrl = String(inputs.baseUrl ?? '').replace(/\/$/, '');
    if (!baseUrl) throw new Error('baseUrl is required.');

    const getBearerToken = (): string => {
      if (inputs.accessToken) return `Bearer ${inputs.accessToken}`;
      if (inputs.apiKey) return `users API-Key ${inputs.apiKey}`;
      return '';
    };

    const authHeader = getBearerToken();

    const payloadFetch = async (
      method: string,
      path: string,
      body?: any,
      requireAuth = true
    ): Promise<any> => {
      logger?.log(`[PayloadCMS] ${method} ${path}`);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (requireAuth && authHeader) headers['Authorization'] = authHeader;
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (res.status === 204) return {};
      const text = await res.text();
      if (!text) return {};
      let data: any;
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if (!res.ok) {
        const msg = data?.errors?.[0]?.message || data?.message || `PayloadCMS API error: ${res.status}`;
        throw new Error(msg);
      }
      return data;
    };

    switch (actionName) {
      // ── Documents (Generic Collection) ────────────────────────────────
      case 'listDocuments': {
        const collection = String(inputs.collection ?? '').trim();
        if (!collection) throw new Error('collection is required.');
        const page = inputs.page ?? 1;
        const limit = inputs.limit ?? 10;
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (inputs.where) params.set('where', typeof inputs.where === 'string' ? inputs.where : JSON.stringify(inputs.where));
        if (inputs.sort) params.set('sort', inputs.sort);
        if (inputs.depth) params.set('depth', String(inputs.depth));
        const data = await payloadFetch('GET', `/api/${collection}?${params.toString()}`);
        return { output: data };
      }

      case 'getDocument': {
        const collection = String(inputs.collection ?? '').trim();
        const id = String(inputs.id ?? '').trim();
        if (!collection) throw new Error('collection is required.');
        if (!id) throw new Error('id is required.');
        const params = new URLSearchParams();
        if (inputs.depth) params.set('depth', String(inputs.depth));
        const query = params.toString() ? `?${params.toString()}` : '';
        const data = await payloadFetch('GET', `/api/${collection}/${id}${query}`);
        return { output: data };
      }

      case 'createDocument': {
        const collection = String(inputs.collection ?? '').trim();
        if (!collection) throw new Error('collection is required.');
        const body = inputs.data ?? inputs.document ?? {};
        const data = await payloadFetch('POST', `/api/${collection}`, body);
        return { output: data };
      }

      case 'updateDocument': {
        const collection = String(inputs.collection ?? '').trim();
        const id = String(inputs.id ?? '').trim();
        if (!collection) throw new Error('collection is required.');
        if (!id) throw new Error('id is required.');
        const body = inputs.data ?? inputs.document ?? {};
        const data = await payloadFetch('PATCH', `/api/${collection}/${id}`, body);
        return { output: data };
      }

      case 'deleteDocument': {
        const collection = String(inputs.collection ?? '').trim();
        const id = String(inputs.id ?? '').trim();
        if (!collection) throw new Error('collection is required.');
        if (!id) throw new Error('id is required.');
        const data = await payloadFetch('DELETE', `/api/${collection}/${id}`);
        return { output: { success: true, id, ...data } };
      }

      // ── Auth ──────────────────────────────────────────────────────────
      case 'login': {
        const email = String(inputs.email ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        if (!email || !password) throw new Error('email and password are required.');
        const collection = String(inputs.collection ?? 'users');
        const data = await payloadFetch(
          'POST',
          `/api/${collection}/login`,
          { email, password },
          false
        );
        return { output: data };
      }

      case 'logout': {
        const collection = String(inputs.collection ?? 'users');
        const data = await payloadFetch('POST', `/api/${collection}/logout`, {});
        return { output: { success: true, ...data } };
      }

      case 'refreshToken': {
        const collection = String(inputs.collection ?? 'users');
        const data = await payloadFetch('POST', `/api/${collection}/refresh-token`, {});
        return { output: data };
      }

      // ── Collections / Globals (Meta) ──────────────────────────────────
      case 'listCollections': {
        const data = await payloadFetch('GET', '/api');
        return { output: data };
      }

      case 'listGlobals': {
        const data = await payloadFetch('GET', '/api/globals');
        return { output: data };
      }

      case 'getGlobal': {
        const slug = String(inputs.slug ?? '').trim();
        if (!slug) throw new Error('slug is required.');
        const params = new URLSearchParams();
        if (inputs.depth) params.set('depth', String(inputs.depth));
        const query = params.toString() ? `?${params.toString()}` : '';
        const data = await payloadFetch('GET', `/api/globals/${slug}${query}`);
        return { output: data };
      }

      case 'updateGlobal': {
        const slug = String(inputs.slug ?? '').trim();
        if (!slug) throw new Error('slug is required.');
        const body = inputs.data ?? inputs.document ?? {};
        const data = await payloadFetch('POST', `/api/globals/${slug}`, body);
        return { output: data };
      }

      // ── Media ─────────────────────────────────────────────────────────
      case 'uploadMedia': {
        const collection = String(inputs.collection ?? 'media');
        // Payload CMS accepts JSON with base64 or a URL field for file uploads
        const body = inputs.data ?? {};
        if (inputs.url) body.url = inputs.url;
        if (inputs.filename) body.filename = inputs.filename;
        if (inputs.alt) body.alt = inputs.alt;
        const data = await payloadFetch('POST', `/api/${collection}`, body);
        return { output: data };
      }

      case 'listMedia': {
        const collection = String(inputs.collection ?? 'media');
        const page = inputs.page ?? 1;
        const limit = inputs.limit ?? 10;
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (inputs.sort) params.set('sort', inputs.sort);
        const data = await payloadFetch('GET', `/api/${collection}?${params.toString()}`);
        return { output: data };
      }

      case 'deleteMedia': {
        const collection = String(inputs.collection ?? 'media');
        const id = String(inputs.id ?? '').trim();
        if (!id) throw new Error('id is required.');
        const data = await payloadFetch('DELETE', `/api/${collection}/${id}`);
        return { output: { success: true, id, ...data } };
      }

      default:
        logger?.log(`[PayloadCMS] Unknown action: ${actionName}`);
        return { error: `Unknown PayloadCMS action: "${actionName}"` };
    }
  } catch (err: any) {
    const message = err?.message ?? String(err);
    logger?.log(`[PayloadCMS] Error: ${message}`);
    return { error: message };
  }
}
