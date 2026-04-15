'use server';

export async function executeTwentyCRMAction(actionName: string, inputs: any, user: any, logger: any) {
  const baseUrl = inputs.baseUrl || 'https://api.twenty.com';
  const REST_BASE = `${baseUrl}/rest`;
  const METADATA_BASE = `${baseUrl}/metadata`;
  const { apiKey } = inputs;

  if (!apiKey) {
    return { error: 'apiKey is required' };
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  async function restReq(method: string, path: string, body?: any) {
    const res = await fetch(`${REST_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twenty CRM REST ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async function metaReq(method: string, path: string, body?: any) {
    const res = await fetch(`${METADATA_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twenty CRM Metadata ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async function graphqlReq(query: string, variables?: any) {
    const res = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twenty CRM GraphQL failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  try {
    switch (actionName) {
      case 'listObjects': {
        const data = await metaReq('GET', '/objects');
        return { output: data };
      }

      case 'getObject': {
        const { objectId } = inputs;
        if (!objectId) return { error: 'objectId is required' };
        const data = await metaReq('GET', `/objects/${objectId}`);
        return { output: data };
      }

      case 'createObject': {
        const { nameSingular, namePlural, labelSingular, labelPlural, description } = inputs;
        if (!nameSingular || !namePlural) return { error: 'nameSingular and namePlural are required' };
        const data = await metaReq('POST', '/objects', {
          nameSingular,
          namePlural,
          labelSingular: labelSingular || nameSingular,
          labelPlural: labelPlural || namePlural,
          description,
        });
        return { output: data };
      }

      case 'updateObject': {
        const { objectId, ...updates } = inputs;
        if (!objectId) return { error: 'objectId is required' };
        const { apiKey: _ak, baseUrl: _bu, ...fields } = updates;
        const data = await metaReq('PATCH', `/objects/${objectId}`, fields);
        return { output: data };
      }

      case 'deleteObject': {
        const { objectId } = inputs;
        if (!objectId) return { error: 'objectId is required' };
        const data = await metaReq('DELETE', `/objects/${objectId}`);
        return { output: data };
      }

      case 'listRecords': {
        const { objectNamePlural, filter, orderBy, limit = 20 } = inputs;
        if (!objectNamePlural) return { error: 'objectNamePlural is required' };
        const params = new URLSearchParams({ limit: String(limit) });
        if (filter) params.set('filter', JSON.stringify(filter));
        if (orderBy) params.set('orderBy', JSON.stringify(orderBy));
        const data = await restReq('GET', `/${objectNamePlural}?${params.toString()}`);
        return { output: data };
      }

      case 'getRecord': {
        const { objectNamePlural, recordId } = inputs;
        if (!objectNamePlural || !recordId) return { error: 'objectNamePlural and recordId are required' };
        const data = await restReq('GET', `/${objectNamePlural}/${recordId}`);
        return { output: data };
      }

      case 'createRecord': {
        const { objectNamePlural, data: recordData } = inputs;
        if (!objectNamePlural || !recordData) return { error: 'objectNamePlural and data are required' };
        const result = await restReq('POST', `/${objectNamePlural}`, recordData);
        return { output: result };
      }

      case 'updateRecord': {
        const { objectNamePlural, recordId, data: recordData } = inputs;
        if (!objectNamePlural || !recordId || !recordData) return { error: 'objectNamePlural, recordId, and data are required' };
        const result = await restReq('PATCH', `/${objectNamePlural}/${recordId}`, recordData);
        return { output: result };
      }

      case 'deleteRecord': {
        const { objectNamePlural, recordId } = inputs;
        if (!objectNamePlural || !recordId) return { error: 'objectNamePlural and recordId are required' };
        const result = await restReq('DELETE', `/${objectNamePlural}/${recordId}`);
        return { output: result };
      }

      case 'listRelations': {
        const data = await metaReq('GET', '/relations');
        return { output: data };
      }

      case 'createRelation': {
        const { fromObjectId, toObjectId, relationType, fromName, toName } = inputs;
        if (!fromObjectId || !toObjectId || !relationType) {
          return { error: 'fromObjectId, toObjectId, and relationType are required' };
        }
        const data = await metaReq('POST', '/relations', {
          fromObjectMetadataId: fromObjectId,
          toObjectMetadataId: toObjectId,
          relationType,
          fromName: fromName || 'from',
          toName: toName || 'to',
        });
        return { output: data };
      }

      case 'deleteRelation': {
        const { relationId } = inputs;
        if (!relationId) return { error: 'relationId is required' };
        const data = await metaReq('DELETE', `/relations/${relationId}`);
        return { output: data };
      }

      case 'listFields': {
        const { objectId } = inputs;
        if (!objectId) return { error: 'objectId is required' };
        const data = await metaReq('GET', `/fields?objectMetadataId=${objectId}`);
        return { output: data };
      }

      case 'createField': {
        const { objectId, name, label, type, description } = inputs;
        if (!objectId || !name || !type) return { error: 'objectId, name, and type are required' };
        const data = await metaReq('POST', '/fields', {
          objectMetadataId: objectId,
          name,
          label: label || name,
          type,
          description,
        });
        return { output: data };
      }

      default:
        return { error: `Unknown Twenty CRM action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Twenty CRM action error: ${err.message}`);
    return { error: err.message };
  }
}
