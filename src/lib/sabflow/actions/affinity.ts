'use server';

export async function executeAffinityAction(
  actionName: string,
  inputs: Record<string, any>,
  user: any,
  logger: any
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { apiKey, ...params } = inputs;

  if (!apiKey) return { error: 'apiKey is required' };

  const base = 'https://api.affinity.co';
  const authHeader = `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`;

  async function req(
    method: string,
    path: string,
    body?: Record<string, any>
  ) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Affinity ${method} ${path} failed (${res.status}): ${text}`);
    }

    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  try {
    switch (actionName) {
      case 'listPersons': {
        const { term, pageSize } = params;
        const data = await req(
          'GET',
          `/persons?term=${encodeURIComponent(term ?? '')}&page_size=${pageSize ?? 100}`
        );
        return { output: data };
      }

      case 'getPerson': {
        const { personId } = params;
        if (!personId) return { error: 'personId is required' };
        const data = await req('GET', `/persons/${personId}`);
        return { output: data };
      }

      case 'createPerson': {
        const { firstName, lastName, emails, organizationIds } = params;
        if (!firstName) return { error: 'firstName is required' };
        if (!lastName) return { error: 'lastName is required' };
        if (!emails) return { error: 'emails is required' };

        const data = await req('POST', '/persons', {
          first_name: firstName,
          last_name: lastName,
          emails,
          organization_ids: organizationIds ?? [],
        });
        return { output: data };
      }

      case 'deletePerson': {
        const { personId } = params;
        if (!personId) return { error: 'personId is required' };
        await req('DELETE', `/persons/${personId}`);
        return { output: { success: true } };
      }

      case 'listOrganizations': {
        const { term, pageSize } = params;
        const data = await req(
          'GET',
          `/organizations?term=${encodeURIComponent(term ?? '')}&page_size=${pageSize ?? 100}`
        );
        return { output: data };
      }

      case 'getOrganization': {
        const { orgId } = params;
        if (!orgId) return { error: 'orgId is required' };
        const data = await req('GET', `/organizations/${orgId}`);
        return { output: data };
      }

      case 'createOrganization': {
        const { name, domain, personIds } = params;
        if (!name) return { error: 'name is required' };

        const body: Record<string, any> = { name, person_ids: personIds ?? [] };
        if (domain) body.domain = domain;

        const data = await req('POST', '/organizations', body);
        return { output: data };
      }

      case 'listLists': {
        const data = await req('GET', '/lists');
        return { output: data };
      }

      case 'getListEntries': {
        const { listId, pageToken } = params;
        if (!listId) return { error: 'listId is required' };
        const data = await req(
          'GET',
          `/lists/${listId}/list-entries?page_token=${encodeURIComponent(pageToken ?? '')}`
        );
        return { output: data };
      }

      case 'createListEntry': {
        const { listId, entityId, entityType } = params;
        if (!listId) return { error: 'listId is required' };
        if (!entityId) return { error: 'entityId is required' };
        if (!entityType) return { error: 'entityType is required' };

        const data = await req('POST', `/lists/${listId}/list-entries`, {
          entity_id: entityId,
          entity_type: entityType,
        });
        return { output: data };
      }

      case 'deleteListEntry': {
        const { listId, listEntryId } = params;
        if (!listId) return { error: 'listId is required' };
        if (!listEntryId) return { error: 'listEntryId is required' };
        await req('DELETE', `/lists/${listId}/list-entries/${listEntryId}`);
        return { output: { success: true } };
      }

      case 'listNotes': {
        const { personId, orgId } = params;
        const data = await req(
          'GET',
          `/notes?person_id=${personId ?? ''}&organization_id=${orgId ?? ''}`
        );
        return { output: data };
      }

      case 'createNote': {
        const { personIds, orgIds, content, type } = params;
        if (!personIds) return { error: 'personIds is required' };

        const data = await req('POST', '/notes', {
          person_ids: personIds,
          organization_ids: orgIds ?? [],
          content: content ?? '',
          type: type ?? 0,
        });
        return { output: data };
      }

      case 'getFieldValues': {
        const { listEntryId } = params;
        if (!listEntryId) return { error: 'listEntryId is required' };
        const data = await req('GET', `/field-values?list_entry_id=${listEntryId}`);
        return { output: data };
      }

      default:
        return { error: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Affinity action error [${actionName}]:`, err.message);
    return { error: err.message ?? String(err) };
  }
}
