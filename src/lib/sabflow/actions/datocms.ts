'use server';

export async function executeDatoCMSAction(
  actionName: string,
  inputs: any,
  user: any,
  logger: any
): Promise<{ output?: any; error?: string }> {
  try {
    const apiToken = String(inputs.apiToken ?? '').trim();
    if (!apiToken) throw new Error('apiToken is required.');

    const baseUrl = 'https://site-api.datocms.com';

    const datoFetch = async (method: string, path: string, body?: any): Promise<any> => {
      logger?.log(`[DatoCMS] ${method} ${path}`);
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'X-Api-Version': '3',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (res.status === 204) return {};
      const text = await res.text();
      if (!text) return {};
      let data: any;
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if (!res.ok) {
        const msg = data?.data?.[0]?.attributes?.details?.field
          ? `${data.data[0].attributes.details.field}: ${data.data[0].attributes.details.code}`
          : data?.message || `DatoCMS API error: ${res.status}`;
        throw new Error(msg);
      }
      return data;
    };

    switch (actionName) {
      // ── Item Types (Models) ────────────────────────────────────────────
      case 'listItemTypes': {
        const data = await datoFetch('GET', '/item-types');
        return { output: data };
      }

      case 'getItemType': {
        const id = String(inputs.itemTypeId ?? '').trim();
        if (!id) throw new Error('itemTypeId is required.');
        const data = await datoFetch('GET', `/item-types/${id}`);
        return { output: data };
      }

      case 'createItemType': {
        if (!inputs.name) throw new Error('name is required.');
        const body = {
          data: {
            type: 'item_type',
            attributes: {
              name: inputs.name,
              api_key: inputs.apiKey ?? inputs.name.toLowerCase().replace(/\s+/g, '_'),
              singleton: inputs.singleton ?? false,
              sortable: inputs.sortable ?? false,
              modular_block: inputs.modularBlock ?? false,
              tree: inputs.tree ?? false,
              draft_mode_active: inputs.draftModeActive ?? false,
              ordering_direction: inputs.orderingDirection ?? null,
            },
          },
        };
        const data = await datoFetch('POST', '/item-types', body);
        return { output: data };
      }

      // ── Items (Records) ───────────────────────────────────────────────
      case 'listItems': {
        const itemType = String(inputs.itemTypeId ?? '').trim();
        const page = inputs.page ?? 1;
        const perPage = inputs.perPage ?? 30;
        const params = new URLSearchParams({
          'filter[type]': itemType,
          'page[offset]': String((page - 1) * perPage),
          'page[limit]': String(perPage),
        });
        if (inputs.query) params.set('filter[query]', inputs.query);
        const data = await datoFetch('GET', `/items?${params.toString()}`);
        return { output: data };
      }

      case 'getItem': {
        const id = String(inputs.itemId ?? '').trim();
        if (!id) throw new Error('itemId is required.');
        const data = await datoFetch('GET', `/items/${id}`);
        return { output: data };
      }

      case 'createItem': {
        const itemType = String(inputs.itemTypeId ?? '').trim();
        if (!itemType) throw new Error('itemTypeId is required.');
        const attributes = inputs.attributes ?? {};
        const body = {
          data: {
            type: 'item',
            attributes,
            relationships: {
              item_type: { data: { type: 'item_type', id: itemType } },
            },
          },
        };
        const data = await datoFetch('POST', '/items', body);
        return { output: data };
      }

      case 'updateItem': {
        const id = String(inputs.itemId ?? '').trim();
        if (!id) throw new Error('itemId is required.');
        const body = {
          data: {
            type: 'item',
            id,
            attributes: inputs.attributes ?? {},
          },
        };
        const data = await datoFetch('PUT', `/items/${id}`, body);
        return { output: data };
      }

      case 'deleteItem': {
        const id = String(inputs.itemId ?? '').trim();
        if (!id) throw new Error('itemId is required.');
        const data = await datoFetch('DELETE', `/items/${id}`);
        return { output: { success: true, id, ...data } };
      }

      case 'publishItem': {
        const id = String(inputs.itemId ?? '').trim();
        if (!id) throw new Error('itemId is required.');
        const data = await datoFetch('PUT', `/items/${id}/publish`);
        return { output: data };
      }

      case 'unpublishItem': {
        const id = String(inputs.itemId ?? '').trim();
        if (!id) throw new Error('itemId is required.');
        const data = await datoFetch('PUT', `/items/${id}/unpublish`);
        return { output: data };
      }

      // ── Uploads (Media) ───────────────────────────────────────────────
      case 'listUploads': {
        const page = inputs.page ?? 1;
        const perPage = inputs.perPage ?? 30;
        const params = new URLSearchParams({
          'page[offset]': String((page - 1) * perPage),
          'page[limit]': String(perPage),
        });
        if (inputs.query) params.set('filter[query]', inputs.query);
        if (inputs.type) params.set('filter[type]', inputs.type);
        const data = await datoFetch('GET', `/uploads?${params.toString()}`);
        return { output: data };
      }

      case 'getUpload': {
        const id = String(inputs.uploadId ?? '').trim();
        if (!id) throw new Error('uploadId is required.');
        const data = await datoFetch('GET', `/uploads/${id}`);
        return { output: data };
      }

      case 'createUpload': {
        if (!inputs.url && !inputs.filename) throw new Error('url or filename is required.');
        const body = {
          data: {
            type: 'upload',
            attributes: {
              url: inputs.url ?? undefined,
              filename: inputs.filename ?? undefined,
              default_field_metadata: inputs.metadata ?? {
                en: { alt: null, title: null, custom_data: {} },
              },
              tags: inputs.tags ?? [],
              notes: inputs.notes ?? null,
              author: inputs.author ?? null,
              copyright: inputs.copyright ?? null,
            },
          },
        };
        const data = await datoFetch('POST', '/uploads', body);
        return { output: data };
      }

      // ── Sites ─────────────────────────────────────────────────────────
      case 'listSites': {
        const data = await datoFetch('GET', '/sites');
        return { output: data };
      }

      case 'getSite': {
        const data = await datoFetch('GET', '/site');
        return { output: data };
      }

      default:
        logger?.log(`[DatoCMS] Unknown action: ${actionName}`);
        return { error: `Unknown DatoCMS action: "${actionName}"` };
    }
  } catch (err: any) {
    const message = err?.message ?? String(err);
    logger?.log(`[DatoCMS] Error: ${message}`);
    return { error: message };
  }
}
