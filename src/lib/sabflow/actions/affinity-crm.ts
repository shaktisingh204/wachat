'use server';

export async function executeAffinityCRMAction(actionName: string, inputs: any, user: any, logger: any) {
  const BASE_URL = 'https://api.affinity.co';
  const { apiKey } = inputs;

  if (!apiKey) {
    return { error: 'apiKey is required' };
  }

  const encoded = Buffer.from(':' + apiKey).toString('base64');
  const headers: Record<string, string> = {
    'Authorization': `Basic ${encoded}`,
    'Content-Type': 'application/json',
  };

  async function req(method: string, path: string, body?: any) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Affinity CRM ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  try {
    switch (actionName) {
      case 'listPersons': {
        const { term, limit = 50, page_token } = inputs;
        const params = new URLSearchParams({ term: term || '', limit: String(limit) });
        if (page_token) params.set('page_token', page_token);
        const data = await req('GET', `/persons?${params.toString()}`);
        return { output: data };
      }

      case 'getPerson': {
        const { personId } = inputs;
        if (!personId) return { error: 'personId is required' };
        const data = await req('GET', `/persons/${personId}`);
        return { output: data };
      }

      case 'createPerson': {
        const { firstName, lastName, emails, phones } = inputs;
        if (!firstName || !lastName) return { error: 'firstName and lastName are required' };
        const data = await req('POST', '/persons', {
          first_name: firstName,
          last_name: lastName,
          emails: emails || [],
          phones: phones || [],
        });
        return { output: data };
      }

      case 'updatePerson': {
        const { personId, firstName, lastName, emails, phones } = inputs;
        if (!personId) return { error: 'personId is required' };
        const body: any = {};
        if (firstName) body.first_name = firstName;
        if (lastName) body.last_name = lastName;
        if (emails) body.emails = emails;
        if (phones) body.phones = phones;
        const data = await req('PUT', `/persons/${personId}`, body);
        return { output: data };
      }

      case 'deletePerson': {
        const { personId } = inputs;
        if (!personId) return { error: 'personId is required' };
        const data = await req('DELETE', `/persons/${personId}`);
        return { output: data };
      }

      case 'listOrganizations': {
        const { term, limit = 50, page_token } = inputs;
        const params = new URLSearchParams({ term: term || '', limit: String(limit) });
        if (page_token) params.set('page_token', page_token);
        const data = await req('GET', `/organizations?${params.toString()}`);
        return { output: data };
      }

      case 'getOrganization': {
        const { organizationId } = inputs;
        if (!organizationId) return { error: 'organizationId is required' };
        const data = await req('GET', `/organizations/${organizationId}`);
        return { output: data };
      }

      case 'createOrganization': {
        const { name, domain, persons } = inputs;
        if (!name) return { error: 'name is required' };
        const data = await req('POST', '/organizations', {
          name,
          domain: domain || '',
          person_ids: persons || [],
        });
        return { output: data };
      }

      case 'listLists': {
        const data = await req('GET', '/lists');
        return { output: data };
      }

      case 'getList': {
        const { listId } = inputs;
        if (!listId) return { error: 'listId is required' };
        const data = await req('GET', `/lists/${listId}`);
        return { output: data };
      }

      case 'listListEntries': {
        const { listId, page_size = 100, page_token } = inputs;
        if (!listId) return { error: 'listId is required' };
        const params = new URLSearchParams({ page_size: String(page_size) });
        if (page_token) params.set('page_token', page_token);
        const data = await req('GET', `/lists/${listId}/list-entries?${params.toString()}`);
        return { output: data };
      }

      case 'createListEntry': {
        const { listId, entityId } = inputs;
        if (!listId || !entityId) return { error: 'listId and entityId are required' };
        const data = await req('POST', `/lists/${listId}/list-entries`, { entity_id: entityId });
        return { output: data };
      }

      case 'deleteListEntry': {
        const { listId, listEntryId } = inputs;
        if (!listId || !listEntryId) return { error: 'listId and listEntryId are required' };
        const data = await req('DELETE', `/lists/${listId}/list-entries/${listEntryId}`);
        return { output: data };
      }

      case 'listFields': {
        const data = await req('GET', '/fields');
        return { output: data };
      }

      case 'createFieldValue': {
        const { fieldId, entityId, value } = inputs;
        if (!fieldId || !entityId || value === undefined) return { error: 'fieldId, entityId, and value are required' };
        const data = await req('POST', '/field-values', {
          field_id: fieldId,
          entity_id: entityId,
          value,
        });
        return { output: data };
      }

      default:
        return { error: `Unknown Affinity CRM action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Affinity CRM action error: ${err.message}`);
    return { error: err.message };
  }
}
