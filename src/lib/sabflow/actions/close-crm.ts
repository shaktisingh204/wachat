'use server';

export async function executeCloseCrmAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = 'https://api.close.com/api/v1';
    const authHeader = `Basic ${Buffer.from(inputs.apiKey + ':').toString('base64')}`;
    const headers: Record<string, string> = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listLeads': {
        const limit = inputs.limit || 20;
        const skip = inputs.skip || 0;
        const res = await fetch(`${baseUrl}/lead/?_limit=${limit}&_skip=${skip}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to list leads' };
        return { output: data };
      }

      case 'getLead': {
        const leadId = inputs.leadId;
        const res = await fetch(`${baseUrl}/lead/${leadId}/`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to get lead' };
        return { output: data };
      }

      case 'createLead': {
        const body = inputs.lead || {};
        const res = await fetch(`${baseUrl}/lead/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to create lead' };
        return { output: data };
      }

      case 'updateLead': {
        const leadId = inputs.leadId;
        const body = inputs.lead || {};
        const res = await fetch(`${baseUrl}/lead/${leadId}/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to update lead' };
        return { output: data };
      }

      case 'deleteLead': {
        const leadId = inputs.leadId;
        const res = await fetch(`${baseUrl}/lead/${leadId}/`, { method: 'DELETE', headers });
        if (res.status === 204) return { output: { success: true } };
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to delete lead' };
        return { output: data };
      }

      case 'listContacts': {
        const limit = inputs.limit || 20;
        const skip = inputs.skip || 0;
        const res = await fetch(`${baseUrl}/contact/?_limit=${limit}&_skip=${skip}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to list contacts' };
        return { output: data };
      }

      case 'getContact': {
        const contactId = inputs.contactId;
        const res = await fetch(`${baseUrl}/contact/${contactId}/`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to get contact' };
        return { output: data };
      }

      case 'createContact': {
        const body = inputs.contact || {};
        const res = await fetch(`${baseUrl}/contact/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to create contact' };
        return { output: data };
      }

      case 'listActivities': {
        const limit = inputs.limit || 20;
        const skip = inputs.skip || 0;
        const type = inputs.type ? `&type=${inputs.type}` : '';
        const res = await fetch(`${baseUrl}/activity/?_limit=${limit}&_skip=${skip}${type}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to list activities' };
        return { output: data };
      }

      case 'createActivity': {
        const body = inputs.activity || {};
        const type = inputs.activityType || 'note';
        const res = await fetch(`${baseUrl}/activity/${type}/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to create activity' };
        return { output: data };
      }

      case 'listOpportunities': {
        const limit = inputs.limit || 20;
        const skip = inputs.skip || 0;
        const res = await fetch(`${baseUrl}/opportunity/?_limit=${limit}&_skip=${skip}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to list opportunities' };
        return { output: data };
      }

      case 'getOpportunity': {
        const opportunityId = inputs.opportunityId;
        const res = await fetch(`${baseUrl}/opportunity/${opportunityId}/`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to get opportunity' };
        return { output: data };
      }

      case 'createOpportunity': {
        const body = inputs.opportunity || {};
        const res = await fetch(`${baseUrl}/opportunity/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to create opportunity' };
        return { output: data };
      }

      case 'updateOpportunity': {
        const opportunityId = inputs.opportunityId;
        const body = inputs.opportunity || {};
        const res = await fetch(`${baseUrl}/opportunity/${opportunityId}/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to update opportunity' };
        return { output: data };
      }

      case 'listSequences': {
        const limit = inputs.limit || 20;
        const skip = inputs.skip || 0;
        const res = await fetch(`${baseUrl}/sequence/?_limit=${limit}&_skip=${skip}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Failed to list sequences' };
        return { output: data };
      }

      default:
        return { error: `Unknown Close CRM action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Close CRM action error: ${err.message}`);
    return { error: err.message || 'Close CRM action failed' };
  }
}
