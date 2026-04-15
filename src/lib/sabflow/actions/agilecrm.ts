'use server';

export async function executeAgileCrmAction(
  actionName: string,
  inputs: Record<string, any>,
  user: any,
  logger: any
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { domain, email, apiKey, ...params } = inputs;

  if (!domain) return { error: 'domain is required' };
  if (!email) return { error: 'email is required' };
  if (!apiKey) return { error: 'apiKey is required' };

  const base = `https://${domain}.agilecrm.com/dev/api`;
  const authHeader = `Basic ${Buffer.from(`${email}:${apiKey}`).toString('base64')}`;

  async function req(
    method: string,
    path: string,
    body?: Record<string, any>
  ) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AgileCRM ${method} ${path} failed (${res.status}): ${text}`);
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
        const { page, limit } = params;
        const data = await req(
          'GET',
          `/contacts?page_size=${limit ?? 25}&cursor=${page ?? ''}`
        );
        return { output: { contacts: Array.isArray(data) ? data : [] } };
      }

      case 'getContact': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('GET', `/contacts/${contactId}`);
        return { output: data };
      }

      case 'createContact': {
        const { firstName, lastName, email: contactEmail, phone, company, tags } = params;
        if (!firstName) return { error: 'firstName is required' };
        if (!lastName) return { error: 'lastName is required' };
        if (!contactEmail) return { error: 'email is required' };

        const body = {
          type: 'PERSON',
          tags: tags ?? [],
          star_value: 0,
          properties: [
            { type: 'SYSTEM', name: 'first_name', value: firstName },
            { type: 'SYSTEM', name: 'last_name', value: lastName },
            { type: 'SYSTEM', name: 'email', value: [{ subtype: 'work', value: contactEmail }] },
            { type: 'SYSTEM', name: 'phone', value: [{ subtype: 'work', value: phone ?? '' }] },
            { type: 'SYSTEM', name: 'company', value: company ?? '' },
          ],
        };
        const data = await req('POST', '/contacts', body);
        return { output: data };
      }

      case 'updateContact': {
        const { contactId, properties } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!properties) return { error: 'properties is required' };
        const data = await req('PUT', '/contacts/edit-properties', {
          id: contactId,
          properties,
        });
        return { output: data };
      }

      case 'deleteContact': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        await req('DELETE', `/contacts/${contactId}`);
        return { output: { deleted: true } };
      }

      case 'addTagToContact': {
        const { contactId, tags } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!tags) return { error: 'tags is required' };
        const data = await req('POST', '/contacts/edit/tags', { id: contactId, tags });
        return { output: { tags: Array.isArray(data) ? data : [] } };
      }

      case 'removeTagFromContact': {
        const { contactId, tags } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!tags) return { error: 'tags is required' };
        const data = await req('DELETE', '/contacts/edit/tags', { id: contactId, tags });
        return { output: { tags: Array.isArray(data) ? data : [] } };
      }

      case 'getDeals': {
        const { page, limit } = params;
        const data = await req(
          'GET',
          `/opportunity?page_size=${limit ?? 25}&cursor=${page ?? ''}`
        );
        return { output: { deals: Array.isArray(data) ? data : [] } };
      }

      case 'getDeal': {
        const { dealId } = params;
        if (!dealId) return { error: 'dealId is required' };
        const data = await req('GET', `/opportunity/${dealId}`);
        return { output: data };
      }

      case 'createDeal': {
        const { name, expectedValue, milestone, probability, closeDate } = params;
        if (!name) return { error: 'name is required' };
        if (!expectedValue) return { error: 'expectedValue is required' };
        if (!milestone) return { error: 'milestone is required' };

        const body = {
          name,
          expected_value: expectedValue,
          milestone,
          probability: probability ?? 0,
          close_date: closeDate ?? Math.floor(Date.now() / 1000) + 30 * 86400,
        };
        const data = await req('POST', '/opportunity', body);
        return { output: data };
      }

      case 'updateDeal': {
        const { dealId, data: dealData } = params;
        if (!dealId) return { error: 'dealId is required' };
        if (!dealData) return { error: 'data is required' };
        const result = await req('PUT', '/opportunity', { id: dealId, ...dealData });
        return { output: result };
      }

      case 'createTask': {
        const { subject, description, dueDate, type, priority, statusId, contactId } = params;
        if (!subject) return { error: 'subject is required' };
        if (!description) return { error: 'description is required' };
        if (!dueDate) return { error: 'dueDate is required' };

        const body = {
          subject,
          description,
          due: dueDate,
          type: type ?? 'OTHER',
          priority_type: priority ?? 'NORMAL',
          status: statusId ?? 0,
          contacts: contactId ? [contactId] : [],
        };
        const data = await req('POST', '/tasks', body);
        return { output: data };
      }

      case 'listTasks': {
        const { status, type, page, limit } = params;
        const data = await req(
          'GET',
          `/tasks?pending=${status ?? 'true'}&type=${type ?? ''}&page_size=${limit ?? 25}`
        );
        return { output: { tasks: Array.isArray(data) ? data : [] } };
      }

      case 'sendEmail': {
        const { to, subject, body: emailBody, fromEmail } = params;
        if (!to) return { error: 'to is required' };
        if (!subject) return { error: 'subject is required' };
        if (!emailBody) return { error: 'body is required' };

        const payload = {
          to,
          subject,
          body: emailBody,
          from: fromEmail ?? email,
        };
        await req('POST', '/sendmail', payload);
        return { output: { sent: true } };
      }

      default:
        return { error: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`AgileCRM action error [${actionName}]:`, err.message);
    return { error: err.message ?? String(err) };
  }
}
