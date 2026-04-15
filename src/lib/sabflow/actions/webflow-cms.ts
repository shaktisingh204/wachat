'use server';

export async function executeWebflowCmsAction(
  actionName: string,
  inputs: any,
  user: any,
  logger: any
) {
  try {
    const baseUrl = 'https://api.webflow.com/v2';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${inputs.accessToken}`,
      'Content-Type': 'application/json',
      'accept-version': '2.0.0',
    };

    switch (actionName) {
      case 'listSites': {
        const res = await fetch(`${baseUrl}/sites`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { sites: data.sites ?? data } };
      }

      case 'getSite': {
        const res = await fetch(`${baseUrl}/sites/${inputs.siteId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { site: data } };
      }

      case 'listCollections': {
        const res = await fetch(`${baseUrl}/sites/${inputs.siteId}/collections`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { collections: data.collections ?? data } };
      }

      case 'getCollection': {
        const res = await fetch(`${baseUrl}/collections/${inputs.collectionId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { collection: data } };
      }

      case 'listItems': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${baseUrl}/collections/${inputs.collectionId}/items?${params}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { items: data.items, pagination: data.pagination } };
      }

      case 'getItem': {
        const res = await fetch(`${baseUrl}/collections/${inputs.collectionId}/items/${inputs.itemId}`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { item: data } };
      }

      case 'createItem': {
        const res = await fetch(`${baseUrl}/collections/${inputs.collectionId}/items`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ fieldData: inputs.fieldData, isDraft: inputs.isDraft ?? false }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { item: data } };
      }

      case 'updateItem': {
        const res = await fetch(`${baseUrl}/collections/${inputs.collectionId}/items/${inputs.itemId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fieldData: inputs.fieldData }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { item: data } };
      }

      case 'deleteItem': {
        const res = await fetch(`${baseUrl}/collections/${inputs.collectionId}/items/${inputs.itemId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, itemId: inputs.itemId } };
      }

      case 'publishItem': {
        const res = await fetch(`${baseUrl}/collections/${inputs.collectionId}/items/publish`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ itemIds: [inputs.itemId] }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { published: data } };
      }

      case 'unpublishItem': {
        const res = await fetch(`${baseUrl}/collections/${inputs.collectionId}/items/${inputs.itemId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ isDraft: true }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { item: data } };
      }

      case 'listDomains': {
        const res = await fetch(`${baseUrl}/sites/${inputs.siteId}/domains`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { domains: data.domains ?? data } };
      }

      case 'publishSite': {
        const res = await fetch(`${baseUrl}/sites/${inputs.siteId}/publish`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ domains: inputs.domains ?? [] }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { published: data } };
      }

      case 'listWebhooks': {
        const res = await fetch(`${baseUrl}/sites/${inputs.siteId}/webhooks`, { headers });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { webhooks: data.webhooks ?? data } };
      }

      case 'createWebhook': {
        const res = await fetch(`${baseUrl}/sites/${inputs.siteId}/webhooks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ triggerType: inputs.triggerType, url: inputs.url, filter: inputs.filter }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { webhook: data } };
      }

      default:
        return { error: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeWebflowCmsAction error: ${err.message}`);
    return { error: err.message ?? 'Unknown error' };
  }
}
