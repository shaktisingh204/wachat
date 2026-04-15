'use server';

export async function executeHighLevelAction(
  actionName: string,
  inputs: Record<string, any>,
  user: any,
  logger: any
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { apiKey, locationId: defaultLocationId, fromNumber, ...params } = inputs;

  if (!apiKey) return { error: 'apiKey is required' };

  const base = 'https://rest.gohighlevel.com/v1';

  async function req(
    method: string,
    path: string,
    body?: Record<string, any>
  ) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HighLevel ${method} ${path} failed (${res.status}): ${text}`);
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
      case 'getContacts': {
        const { locationId, limit, skip } = params;
        const locId = locationId ?? defaultLocationId;
        if (!locId) return { error: 'locationId is required' };
        const data = await req(
          'GET',
          `/contacts/?locationId=${locId}&limit=${limit ?? 20}&skip=${skip ?? 0}`
        );
        return { output: data };
      }

      case 'getContact': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('GET', `/contacts/${contactId}`);
        return { output: data };
      }

      case 'createContact': {
        const { firstName, lastName, email, phone, tags, source, locationId } = params;
        if (!firstName) return { error: 'firstName is required' };

        const body: Record<string, any> = {
          firstName,
          tags: tags ?? [],
          source: source ?? 'API',
          locationId: locationId ?? defaultLocationId,
        };
        if (lastName) body.lastName = lastName;
        if (email) body.email = email;
        if (phone) body.phone = phone;

        const data = await req('POST', '/contacts/', body);
        return { output: data };
      }

      case 'updateContact': {
        const { contactId, data: contactData } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!contactData) return { error: 'data is required' };
        const result = await req('PUT', `/contacts/${contactId}`, contactData);
        return { output: result };
      }

      case 'deleteContact': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        await req('DELETE', `/contacts/${contactId}`);
        return { output: { succeeded: true } };
      }

      case 'addContactToWorkflow': {
        const { contactId, workflowId } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!workflowId) return { error: 'workflowId is required' };
        await req('POST', `/contacts/${contactId}/workflow/${workflowId}`);
        return { output: { succeeded: true } };
      }

      case 'removeContactFromWorkflow': {
        const { contactId, workflowId } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!workflowId) return { error: 'workflowId is required' };
        await req('DELETE', `/contacts/${contactId}/workflow/${workflowId}`);
        return { output: { succeeded: true } };
      }

      case 'getPipelines': {
        const { locationId } = params;
        const locId = locationId ?? defaultLocationId;
        if (!locId) return { error: 'locationId is required' };
        const data = await req('GET', `/pipelines/?locationId=${locId}`);
        return { output: data };
      }

      case 'getOpportunities': {
        const { pipelineId, locationId, limit, skip } = params;
        if (!pipelineId) return { error: 'pipelineId is required' };
        const locId = locationId ?? defaultLocationId;
        if (!locId) return { error: 'locationId is required' };
        const data = await req(
          'GET',
          `/pipelines/${pipelineId}/opportunities?locationId=${locId}&limit=${limit ?? 20}&skip=${skip ?? 0}`
        );
        return { output: data };
      }

      case 'createOpportunity': {
        const {
          pipelineId,
          contactId,
          name,
          monetaryValue,
          stageId,
          status,
          source,
          locationId,
        } = params;
        if (!pipelineId) return { error: 'pipelineId is required' };
        if (!contactId) return { error: 'contactId is required' };
        if (!name) return { error: 'name is required' };

        const body: Record<string, any> = {
          contactId,
          name,
          monetaryValue: monetaryValue ?? 0,
          status: status ?? 'open',
          locationId: locationId ?? defaultLocationId,
        };
        if (stageId) body.pipelineStageId = stageId;
        if (source) body.source = source;

        const data = await req('POST', `/pipelines/${pipelineId}/opportunities`, body);
        return { output: data };
      }

      case 'updateOpportunity': {
        const { pipelineId, opportunityId, data: oppData } = params;
        if (!pipelineId) return { error: 'pipelineId is required' };
        if (!opportunityId) return { error: 'opportunityId is required' };
        if (!oppData) return { error: 'data is required' };
        const result = await req(
          'PUT',
          `/pipelines/${pipelineId}/opportunities/${opportunityId}`,
          oppData
        );
        return { output: result };
      }

      case 'sendSms': {
        const { contactId, message, from } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!message) return { error: 'message is required' };

        const body: Record<string, any> = {
          type: 'SMS',
          contactId,
          message,
        };
        if (from ?? fromNumber) body.from = from ?? fromNumber;

        const data = await req('POST', '/conversations/messages', body);
        return { output: data };
      }

      case 'sendEmail': {
        const { contactId, subject, html, from, fromName } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!subject) return { error: 'subject is required' };
        if (!html) return { error: 'html is required' };

        const body: Record<string, any> = { type: 'Email', contactId, subject, html };
        if (from) body.from = from;
        if (fromName) body.fromName = fromName;

        const data = await req('POST', '/conversations/messages', body);
        return { output: data };
      }

      case 'getLocations': {
        const { companyId, limit } = params;
        const data = await req(
          'GET',
          `/locations/?companyId=${companyId ?? ''}&limit=${limit ?? 100}`
        );
        return { output: data };
      }

      default:
        return { error: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`HighLevel action error [${actionName}]:`, err.message);
    return { error: err.message ?? String(err) };
  }
}
