'use server';

export async function executeSalesmateAction(
  actionName: string,
  inputs: Record<string, any>,
  user: any,
  logger: any
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { accessToken, linkname, ...params } = inputs;

  if (!accessToken) return { error: 'accessToken is required' };
  if (!linkname) return { error: 'linkname is required' };

  const base = 'https://api.salesmate.io';

  async function req(
    method: string,
    path: string,
    body?: Record<string, any>
  ) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        accessToken: accessToken,
        'x-linkname': linkname,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Salesmate ${method} ${path} failed (${res.status}): ${text}`);
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
      case 'getDeals': {
        const { page, rows, query } = params;
        const data = await req('POST', '/v3/deals/search', {
          pageNo: page ?? 1,
          rows: rows ?? 20,
          filters: [],
          sortBy: 'id',
          sortOrder: 'DESC',
          searchQuery: query ?? '',
        });
        return { output: data };
      }

      case 'getDeal': {
        const { dealId } = params;
        if (!dealId) return { error: 'dealId is required' };
        const data = await req('GET', `/v3/deals/${dealId}`);
        return { output: data };
      }

      case 'createDeal': {
        const { title, amount, status, ownerId, companyId, contactId, currency, closeDate } = params;
        if (!title) return { error: 'title is required' };
        if (amount === undefined || amount === null) return { error: 'amount is required' };

        const body: Record<string, any> = {
          title,
          amount,
          dealStatus: status ?? 'Open',
          currency: currency ?? 'USD',
        };
        if (ownerId) body.owner = { id: ownerId };
        if (companyId) body.company = { id: companyId };
        if (contactId) body.contact = { id: contactId };
        if (closeDate) body.closedDate = closeDate;

        const data = await req('POST', '/v3/deals', body);
        return { output: data };
      }

      case 'updateDeal': {
        const { dealId, data: dealData } = params;
        if (!dealId) return { error: 'dealId is required' };
        if (!dealData) return { error: 'data is required' };
        const result = await req('PUT', `/v3/deals/${dealId}`, dealData);
        return { output: result };
      }

      case 'deleteDeal': {
        const { dealId } = params;
        if (!dealId) return { error: 'dealId is required' };
        const data = await req('DELETE', `/v3/deals/${dealId}`);
        return { output: data ?? { data: { deleted: true } } };
      }

      case 'getContacts': {
        const { page, rows, query } = params;
        const data = await req('POST', '/v3/contacts/search', {
          pageNo: page ?? 1,
          rows: rows ?? 20,
          searchQuery: query ?? '',
        });
        return { output: data };
      }

      case 'getContact': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('GET', `/v3/contacts/${contactId}`);
        return { output: data };
      }

      case 'createContact': {
        const { firstName, lastName, email, phone, companyId } = params;
        if (!firstName) return { error: 'firstName is required' };
        if (!lastName) return { error: 'lastName is required' };

        const body: Record<string, any> = { firstName, lastName };
        if (email) body.email = email;
        if (phone) body.phone = phone;
        if (companyId) body.company = { id: companyId };

        const data = await req('POST', '/v3/contacts', body);
        return { output: data };
      }

      case 'updateContact': {
        const { contactId, data: contactData } = params;
        if (!contactId) return { error: 'contactId is required' };
        if (!contactData) return { error: 'data is required' };
        const result = await req('PUT', `/v3/contacts/${contactId}`, contactData);
        return { output: result };
      }

      case 'deleteContact': {
        const { contactId } = params;
        if (!contactId) return { error: 'contactId is required' };
        const data = await req('DELETE', `/v3/contacts/${contactId}`);
        return { output: data ?? { data: { deleted: true } } };
      }

      case 'getCompanies': {
        const { page, rows } = params;
        const data = await req('POST', '/v3/companies/search', {
          pageNo: page ?? 1,
          rows: rows ?? 20,
        });
        return { output: data };
      }

      case 'createCompany': {
        const { name, website, phone, address } = params;
        if (!name) return { error: 'name is required' };

        const body: Record<string, any> = { name };
        if (website) body.website = website;
        if (phone) body.phone = phone;
        if (address) body.billingAddressLine1 = address;

        const data = await req('POST', '/v3/companies', body);
        return { output: data };
      }

      case 'logActivity': {
        const { dealId, type, description, duration, activityDate } = params;
        if (!dealId) return { error: 'dealId is required' };
        if (!type) return { error: 'type is required' };
        if (!description) return { error: 'description is required' };

        const body = {
          deal: { id: dealId },
          type,
          description,
          duration: duration ?? 0,
          activityDate: activityDate ?? new Date().toISOString(),
        };
        const data = await req('POST', '/v3/activities', body);
        return { output: data };
      }

      case 'getActivities': {
        const { dealId } = params;
        const data = await req('POST', '/v3/activities/search', {
          pageNo: 1,
          rows: 20,
          filters: dealId
            ? [{ module: 'deal', field: 'id', op: 'eq', value: dealId }]
            : [],
        });
        return { output: data };
      }

      default:
        return { error: `Unknown action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Salesmate action error [${actionName}]:`, err.message);
    return { error: err.message ?? String(err) };
  }
}
