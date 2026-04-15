'use server';

export async function executeContentfulEnhancedAction(
  actionName: string,
  inputs: any,
  user: any,
  logger: any
) {
  try {
    const spaceId = inputs.spaceId;
    const managementBase = `https://api.contentful.com/spaces/${spaceId}`;
    const deliveryBase = `https://cdn.contentful.com/spaces/${spaceId}`;
    const mgmtHeaders: Record<string, string> = {
      Authorization: `Bearer ${inputs.accessToken}`,
      'Content-Type': 'application/json',
    };
    const deliveryHeaders: Record<string, string> = {
      Authorization: `Bearer ${inputs.deliveryToken}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listContentTypes': {
        const res = await fetch(`${managementBase}/content_types`, { headers: mgmtHeaders });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { contentTypes: data.items, total: data.total } };
      }

      case 'getContentType': {
        const res = await fetch(`${managementBase}/content_types/${inputs.contentTypeId}`, { headers: mgmtHeaders });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { contentType: data } };
      }

      case 'createContentType': {
        const res = await fetch(`${managementBase}/content_types`, {
          method: 'POST',
          headers: mgmtHeaders,
          body: JSON.stringify(inputs.contentType),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { contentType: data } };
      }

      case 'publishContentType': {
        const res = await fetch(`${managementBase}/content_types/${inputs.contentTypeId}/published`, {
          method: 'PUT',
          headers: { ...mgmtHeaders, 'X-Contentful-Version': String(inputs.version ?? 1) },
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { contentType: data } };
      }

      case 'listEntries': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${managementBase}/entries?${params}`, { headers: mgmtHeaders });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { entries: data.items, total: data.total } };
      }

      case 'getEntry': {
        const res = await fetch(`${managementBase}/entries/${inputs.entryId}`, { headers: mgmtHeaders });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { entry: data } };
      }

      case 'createEntry': {
        const res = await fetch(`${managementBase}/entries`, {
          method: 'POST',
          headers: { ...mgmtHeaders, 'X-Contentful-Content-Type': inputs.contentTypeId },
          body: JSON.stringify({ fields: inputs.fields }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { entry: data } };
      }

      case 'updateEntry': {
        const res = await fetch(`${managementBase}/entries/${inputs.entryId}`, {
          method: 'PUT',
          headers: { ...mgmtHeaders, 'X-Contentful-Version': String(inputs.version ?? 1) },
          body: JSON.stringify({ fields: inputs.fields }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { entry: data } };
      }

      case 'deleteEntry': {
        const res = await fetch(`${managementBase}/entries/${inputs.entryId}`, {
          method: 'DELETE',
          headers: mgmtHeaders,
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, entryId: inputs.entryId } };
      }

      case 'publishEntry': {
        const res = await fetch(`${managementBase}/entries/${inputs.entryId}/published`, {
          method: 'PUT',
          headers: { ...mgmtHeaders, 'X-Contentful-Version': String(inputs.version ?? 1) },
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { entry: data } };
      }

      case 'unpublishEntry': {
        const res = await fetch(`${managementBase}/entries/${inputs.entryId}/published`, {
          method: 'DELETE',
          headers: mgmtHeaders,
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { entry: data } };
      }

      case 'listAssets': {
        const params = new URLSearchParams(inputs.query ?? {});
        const res = await fetch(`${managementBase}/assets?${params}`, { headers: mgmtHeaders });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { assets: data.items, total: data.total } };
      }

      case 'createAsset': {
        const res = await fetch(`${managementBase}/assets`, {
          method: 'POST',
          headers: mgmtHeaders,
          body: JSON.stringify({ fields: inputs.fields }),
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { asset: data } };
      }

      case 'processAsset': {
        const locale = inputs.locale ?? 'en-US';
        const res = await fetch(`${managementBase}/assets/${inputs.assetId}/files/${locale}/process`, {
          method: 'PUT',
          headers: { ...mgmtHeaders, 'X-Contentful-Version': String(inputs.version ?? 1) },
        });
        if (!res.ok) return { error: await res.text() };
        return { output: { success: true, assetId: inputs.assetId } };
      }

      case 'publishAsset': {
        const res = await fetch(`${managementBase}/assets/${inputs.assetId}/published`, {
          method: 'PUT',
          headers: { ...mgmtHeaders, 'X-Contentful-Version': String(inputs.version ?? 1) },
        });
        if (!res.ok) return { error: await res.text() };
        const data = await res.json();
        return { output: { asset: data } };
      }

      default:
        return { error: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`executeContentfulEnhancedAction error: ${err.message}`);
    return { error: err.message ?? 'Unknown error' };
  }
}
