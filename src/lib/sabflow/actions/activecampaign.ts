'use server';

export async function executeActivecampaignAction(
  action: string,
  inputs: Record<string, unknown>
): Promise<{ output?: Record<string, unknown>; error?: string }> {
  const apiUrl = inputs.apiUrl as string;
  const apiKey = inputs.apiKey as string;
  if (!apiUrl) return { error: 'Missing apiUrl' };
  if (!apiKey) return { error: 'Missing apiKey' };

  const base = `${apiUrl}/api/3`;
  const headers: Record<string, string> = {
    'Api-Token': apiKey,
    'Content-Type': 'application/json',
  };

  async function acFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<{ output?: Record<string, unknown>; error?: string }> {
    const url = `${base}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });
    if (res.status === 204) return { output: { success: true } };
    const text = await res.text();
    if (!res.ok) return { error: `ActiveCampaign API error ${res.status}: ${text}` };
    try {
      return { output: JSON.parse(text) };
    } catch {
      return { output: { raw: text } };
    }
  }

  switch (action) {
    case 'createContact': {
      const contact: Record<string, unknown> = { email: inputs.email };
      if (inputs.firstName) contact.firstName = inputs.firstName;
      if (inputs.lastName) contact.lastName = inputs.lastName;
      if (inputs.phone) contact.phone = inputs.phone;
      return acFetch('/contacts', {
        method: 'POST',
        body: JSON.stringify({ contact }),
      });
    }

    case 'getContact': {
      const contactId = inputs.contactId as string;
      if (!contactId) return { error: 'Missing contactId' };
      return acFetch(`/contacts/${contactId}`);
    }

    case 'updateContact': {
      const contactId = inputs.contactId as string;
      if (!contactId) return { error: 'Missing contactId' };
      const contact: Record<string, unknown> = {};
      if (inputs.email) contact.email = inputs.email;
      if (inputs.firstName) contact.firstName = inputs.firstName;
      if (inputs.lastName) contact.lastName = inputs.lastName;
      return acFetch(`/contacts/${contactId}`, {
        method: 'PUT',
        body: JSON.stringify({ contact }),
      });
    }

    case 'deleteContact': {
      const contactId = inputs.contactId as string;
      if (!contactId) return { error: 'Missing contactId' };
      return acFetch(`/contacts/${contactId}`, { method: 'DELETE' });
    }

    case 'listContacts': {
      const limit = (inputs.limit as number) || 20;
      const search = inputs.search ? `&search=${encodeURIComponent(inputs.search as string)}` : '';
      return acFetch(`/contacts?limit=${limit}${search}`);
    }

    case 'createDeal': {
      const deal: Record<string, unknown> = {
        title: inputs.title,
        value: inputs.value,
        currency: (inputs.currency as string) || 'USD',
        group: inputs.pipelineId,
        stage: inputs.stageId,
      };
      if (inputs.contactId) deal.contact = inputs.contactId;
      return acFetch('/deals', {
        method: 'POST',
        body: JSON.stringify({ deal }),
      });
    }

    case 'getDeal': {
      const dealId = inputs.dealId as string;
      if (!dealId) return { error: 'Missing dealId' };
      return acFetch(`/deals/${dealId}`);
    }

    case 'updateDeal': {
      const dealId = inputs.dealId as string;
      if (!dealId) return { error: 'Missing dealId' };
      const deal: Record<string, unknown> = {};
      if (inputs.title) deal.title = inputs.title;
      if (inputs.value !== undefined) deal.value = inputs.value;
      if (inputs.stageId) deal.stage = inputs.stageId;
      return acFetch(`/deals/${dealId}`, {
        method: 'PUT',
        body: JSON.stringify({ deal }),
      });
    }

    case 'addContactToList': {
      const contactId = inputs.contactId as string;
      const listId = inputs.listId as string;
      if (!contactId || !listId) return { error: 'Missing contactId or listId' };
      return acFetch('/contactLists', {
        method: 'POST',
        body: JSON.stringify({ contactList: { contact: contactId, list: listId, status: 1 } }),
      });
    }

    case 'removeContactFromList': {
      const contactId = inputs.contactId as string;
      const listId = inputs.listId as string;
      if (!contactId || !listId) return { error: 'Missing contactId or listId' };
      return acFetch('/contactLists', {
        method: 'POST',
        body: JSON.stringify({ contactList: { contact: contactId, list: listId, status: 2 } }),
      });
    }

    case 'createTag': {
      const tag: Record<string, unknown> = {
        tag: inputs.tag,
        tagType: 'contact',
      };
      if (inputs.description) tag.description = inputs.description;
      return acFetch('/tags', {
        method: 'POST',
        body: JSON.stringify({ tag }),
      });
    }

    case 'addTagToContact': {
      const contactId = inputs.contactId as string;
      const tagId = inputs.tagId as string;
      if (!contactId || !tagId) return { error: 'Missing contactId or tagId' };
      return acFetch('/contactTags', {
        method: 'POST',
        body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }),
      });
    }

    case 'sendEmail': {
      const campaignId = inputs.campaignId as string;
      const subscriptionId = inputs.subscriptionId as string;
      if (!campaignId || !subscriptionId) return { error: 'Missing campaignId or subscriptionId' };
      return acFetch(`/campaigns/${campaignId}/send`, {
        method: 'POST',
        body: JSON.stringify({ subscription: subscriptionId }),
      });
    }

    case 'getEmailStats': {
      const campaignId = inputs.campaignId as string;
      if (!campaignId) return { error: 'Missing campaignId' };
      return acFetch(`/campaigns/${campaignId}`);
    }

    case 'createAutomation':
      return { error: 'use ActiveCampaign UI for automation creation' };

    default:
      return { error: `Unknown action: ${action}` };
  }
}
