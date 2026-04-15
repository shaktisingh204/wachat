'use server';

export async function executeCopperCrmAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = 'https://api.copper.com/developer_api/v1';
    const headers: Record<string, string> = {
      'X-PW-AccessToken': inputs.accessToken,
      'X-PW-Application': 'developer_api',
      'X-PW-UserEmail': inputs.userEmail,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listPeople': {
        const body = {
          page_size: inputs.pageSize || 20,
          page_number: inputs.pageNumber || 1,
          ...(inputs.filters || {}),
        };
        const res = await fetch(`${baseUrl}/people/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list people' };
        return { output: data };
      }

      case 'getPerson': {
        const personId = inputs.personId;
        const res = await fetch(`${baseUrl}/people/${personId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to get person' };
        return { output: data };
      }

      case 'createPerson': {
        const body = inputs.person || {};
        const res = await fetch(`${baseUrl}/people`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to create person' };
        return { output: data };
      }

      case 'updatePerson': {
        const personId = inputs.personId;
        const body = inputs.person || {};
        const res = await fetch(`${baseUrl}/people/${personId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to update person' };
        return { output: data };
      }

      case 'deletePerson': {
        const personId = inputs.personId;
        const res = await fetch(`${baseUrl}/people/${personId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to delete person' };
        return { output: data };
      }

      case 'listCompanies': {
        const body = {
          page_size: inputs.pageSize || 20,
          page_number: inputs.pageNumber || 1,
          ...(inputs.filters || {}),
        };
        const res = await fetch(`${baseUrl}/companies/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list companies' };
        return { output: data };
      }

      case 'getCompany': {
        const companyId = inputs.companyId;
        const res = await fetch(`${baseUrl}/companies/${companyId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to get company' };
        return { output: data };
      }

      case 'createCompany': {
        const body = inputs.company || {};
        const res = await fetch(`${baseUrl}/companies`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to create company' };
        return { output: data };
      }

      case 'listOpportunities': {
        const body = {
          page_size: inputs.pageSize || 20,
          page_number: inputs.pageNumber || 1,
          ...(inputs.filters || {}),
        };
        const res = await fetch(`${baseUrl}/opportunities/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list opportunities' };
        return { output: data };
      }

      case 'getOpportunity': {
        const opportunityId = inputs.opportunityId;
        const res = await fetch(`${baseUrl}/opportunities/${opportunityId}`, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to get opportunity' };
        return { output: data };
      }

      case 'createOpportunity': {
        const body = inputs.opportunity || {};
        const res = await fetch(`${baseUrl}/opportunities`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to create opportunity' };
        return { output: data };
      }

      case 'updateOpportunity': {
        const opportunityId = inputs.opportunityId;
        const body = inputs.opportunity || {};
        const res = await fetch(`${baseUrl}/opportunities/${opportunityId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to update opportunity' };
        return { output: data };
      }

      case 'deleteOpportunity': {
        const opportunityId = inputs.opportunityId;
        const res = await fetch(`${baseUrl}/opportunities/${opportunityId}`, { method: 'DELETE', headers });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to delete opportunity' };
        return { output: data };
      }

      case 'listTasks': {
        const body = {
          page_size: inputs.pageSize || 20,
          page_number: inputs.pageNumber || 1,
          ...(inputs.filters || {}),
        };
        const res = await fetch(`${baseUrl}/tasks/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to list tasks' };
        return { output: data };
      }

      case 'createTask': {
        const body = inputs.task || {};
        const res = await fetch(`${baseUrl}/tasks`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.message || 'Failed to create task' };
        return { output: data };
      }

      default:
        return { error: `Unknown Copper CRM action: ${actionName}` };
    }
  } catch (err: any) {
    logger.log(`Copper CRM action error: ${err.message}`);
    return { error: err.message || 'Copper CRM action failed' };
  }
}
