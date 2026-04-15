'use server';

export async function executePipedriveAction(
  action: string,
  inputs: Record<string, any>
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { apiToken, companyDomain, ...params } = inputs;

  if (!apiToken || !companyDomain) {
    return { error: 'apiToken and companyDomain are required' };
  }

  const base = `https://${companyDomain}.pipedrive.com/api/v1`;

  function url(path: string, extra: Record<string, any> = {}): string {
    const q = new URLSearchParams({ api_token: apiToken, ...extra });
    return `${base}${path}?${q.toString()}`;
  }

  async function req(
    method: string,
    path: string,
    query: Record<string, any> = {},
    body?: Record<string, any>
  ) {
    const fullUrl = url(path, query);
    const res = await fetch(fullUrl, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pipedrive ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  try {
    switch (action) {
      case 'getPersons': {
        const { limit = 50, search } = params;
        const query: Record<string, any> = { limit };
        if (search) query.term = search;
        const data = search
          ? await req('GET', '/persons/search', query)
          : await req('GET', '/persons', query);
        return { output: data };
      }

      case 'getPerson': {
        const { personId } = params;
        if (!personId) return { error: 'personId is required' };
        const data = await req('GET', `/persons/${personId}`);
        return { output: data };
      }

      case 'createPerson': {
        const { name, email, phone, orgId } = params;
        if (!name) return { error: 'name is required' };
        const body: Record<string, any> = { name };
        if (email) body.email = email;
        if (phone) body.phone = phone;
        if (orgId) body.org_id = orgId;
        const data = await req('POST', '/persons', {}, body);
        return { output: data };
      }

      case 'updatePerson': {
        const { personId, name, email, phone } = params;
        if (!personId) return { error: 'personId is required' };
        const body: Record<string, any> = {};
        if (name) body.name = name;
        if (email) body.email = email;
        if (phone) body.phone = phone;
        const data = await req('PUT', `/persons/${personId}`, {}, body);
        return { output: data };
      }

      case 'deletePerson': {
        const { personId } = params;
        if (!personId) return { error: 'personId is required' };
        const data = await req('DELETE', `/persons/${personId}`);
        return { output: data };
      }

      case 'getDeals': {
        const { limit = 50, status } = params;
        const query: Record<string, any> = { limit };
        if (status) query.status = status;
        const data = await req('GET', '/deals', query);
        return { output: data };
      }

      case 'getDeal': {
        const { dealId } = params;
        if (!dealId) return { error: 'dealId is required' };
        const data = await req('GET', `/deals/${dealId}`);
        return { output: data };
      }

      case 'createDeal': {
        const { title, personId, orgId, value, currency, stageId } = params;
        if (!title) return { error: 'title is required' };
        const body: Record<string, any> = { title };
        if (personId) body.person_id = personId;
        if (orgId) body.org_id = orgId;
        if (value !== undefined) body.value = value;
        if (currency) body.currency = currency;
        if (stageId) body.stage_id = stageId;
        const data = await req('POST', '/deals', {}, body);
        return { output: data };
      }

      case 'updateDeal': {
        const { dealId, title, status, stageId, value } = params;
        if (!dealId) return { error: 'dealId is required' };
        const body: Record<string, any> = {};
        if (title) body.title = title;
        if (status) body.status = status;
        if (stageId) body.stage_id = stageId;
        if (value !== undefined) body.value = value;
        const data = await req('PUT', `/deals/${dealId}`, {}, body);
        return { output: data };
      }

      case 'deleteDeal': {
        const { dealId } = params;
        if (!dealId) return { error: 'dealId is required' };
        const data = await req('DELETE', `/deals/${dealId}`);
        return { output: data };
      }

      case 'getOrganizations': {
        const { limit = 50 } = params;
        const data = await req('GET', '/organizations', { limit });
        return { output: data };
      }

      case 'createOrganization': {
        const { name, address } = params;
        if (!name) return { error: 'name is required' };
        const body: Record<string, any> = { name };
        if (address) body.address = address;
        const data = await req('POST', '/organizations', {}, body);
        return { output: data };
      }

      case 'getActivities': {
        const { limit = 50, type } = params;
        const query: Record<string, any> = { limit };
        if (type) query.type = type;
        const data = await req('GET', '/activities', query);
        return { output: data };
      }

      case 'createActivity': {
        const { subject, type, dueDate, dueTime, dealId, personId } = params;
        if (!subject) return { error: 'subject is required' };
        if (!type) return { error: 'type is required' };
        if (!dueDate) return { error: 'dueDate is required' };
        const body: Record<string, any> = { subject, type, due_date: dueDate };
        if (dueTime) body.due_time = dueTime;
        if (dealId) body.deal_id = dealId;
        if (personId) body.person_id = personId;
        const data = await req('POST', '/activities', {}, body);
        return { output: data };
      }

      case 'searchDeals': {
        const { term } = params;
        if (!term) return { error: 'term is required' };
        const data = await req('GET', '/deals/search', { term });
        return { output: data };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (err: any) {
    return { error: err.message ?? String(err) };
  }
}
