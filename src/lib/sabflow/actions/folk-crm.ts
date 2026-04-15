'use server';

export async function executeFolkCRMAction(actionName: string, inputs: any, user: any, logger: any) {
  const BASE_URL = 'https://api.folk.app/v2';
  const { apiKey } = inputs;

  if (!apiKey) {
    return { error: 'apiKey is required' };
  }

  const headers: Record<string, string> = {
    'x-folk-api-key': apiKey,
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
      throw new Error(`Folk CRM ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  try {
    switch (actionName) {
      case 'listContacts': {
        const { limit = 50, page = 1 } = inputs;
        const params = new URLSearchParams({ limit: String(limit), page: String(page) });
        const data = await req('GET', `/contacts?${params.toString()}`);
        return { output: data };
      }

      case 'getContact': {
        const { contactId } = inputs;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('GET', `/contacts/${contactId}`);
        return { output: data };
      }

      case 'createContact': {
        const { firstName, lastName, email, phone, company } = inputs;
        if (!firstName) return { error: 'firstName is required' };
        const body: any = { firstName, lastName };
        if (email) body.email = email;
        if (phone) body.phone = phone;
        if (company) body.company = company;
        const data = await req('POST', '/contacts', body);
        return { output: data };
      }

      case 'updateContact': {
        const { contactId, ...updates } = inputs;
        if (!contactId) return { error: 'contactId is required' };
        const { apiKey: _ak, ...fields } = updates;
        const data = await req('PATCH', `/contacts/${contactId}`, fields);
        return { output: data };
      }

      case 'deleteContact': {
        const { contactId } = inputs;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('DELETE', `/contacts/${contactId}`);
        return { output: data };
      }

      case 'listGroups': {
        const data = await req('GET', '/groups');
        return { output: data };
      }

      case 'getGroup': {
        const { groupId } = inputs;
        if (!groupId) return { error: 'groupId is required' };
        const data = await req('GET', `/groups/${groupId}`);
        return { output: data };
      }

      case 'createGroup': {
        const { name, description } = inputs;
        if (!name) return { error: 'name is required' };
        const data = await req('POST', '/groups', { name, description });
        return { output: data };
      }

      case 'addContactToGroup': {
        const { groupId, contactId } = inputs;
        if (!groupId || !contactId) return { error: 'groupId and contactId are required' };
        const data = await req('POST', `/groups/${groupId}/contacts`, { contactId });
        return { output: data };
      }

      case 'removeContactFromGroup': {
        const { groupId, contactId } = inputs;
        if (!groupId || !contactId) return { error: 'groupId and contactId are required' };
        const data = await req('DELETE', `/groups/${groupId}/contacts/${contactId}`);
        return { output: data };
      }

      case 'listNotes': {
        const { contactId } = inputs;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('GET', `/contacts/${contactId}/notes`);
        return { output: data };
      }

      case 'createNote': {
        const { contactId, content } = inputs;
        if (!contactId || !content) return { error: 'contactId and content are required' };
        const data = await req('POST', `/contacts/${contactId}/notes`, { content });
        return { output: data };
      }

      case 'listPipelines': {
        const data = await req('GET', '/pipelines');
        return { output: data };
      }

      case 'getPipeline': {
        const { pipelineId } = inputs;
        if (!pipelineId) return { error: 'pipelineId is required' };
        const data = await req('GET', `/pipelines/${pipelineId}`);
        return { output: data };
      }

      case 'listPipelineStages': {
        const { pipelineId } = inputs;
        if (!pipelineId) return { error: 'pipelineId is required' };
        const data = await req('GET', `/pipelines/${pipelineId}/stages`);
        return { output: data };
      }

      default:
        return { error: `Unknown Folk CRM action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Folk CRM action error: ${err.message}`);
    return { error: err.message };
  }
}
