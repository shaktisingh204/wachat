'use server';

export async function executeTogglAction(
  action: string,
  inputs: Record<string, any>
): Promise<{ output: Record<string, any> } | { error: string }> {
  const { apiToken, ...params } = inputs;

  if (!apiToken) return { error: 'apiToken is required' };

  const base = 'https://api.track.toggl.com/api/v9';
  const authHeader = `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}`;

  async function req(
    method: string,
    url: string,
    body?: Record<string, any>,
    query?: Record<string, string>
  ) {
    let fullUrl = url;
    if (query) fullUrl += `?${new URLSearchParams(query).toString()}`;
    const res = await fetch(fullUrl, {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Toggl ${method} ${url} failed (${res.status}): ${text}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : { success: true };
  }

  try {
    switch (action) {
      case 'getMe': {
        const data = await req('GET', `${base}/me`);
        return { output: data };
      }

      case 'getWorkspaces': {
        const data = await req('GET', `${base}/workspaces`);
        return { output: { workspaces: data } };
      }

      case 'getProjects': {
        const { workspaceId, active = true } = params;
        if (!workspaceId) return { error: 'workspaceId is required' };
        const data = await req(
          'GET',
          `${base}/workspaces/${workspaceId}/projects`,
          undefined,
          { active: String(active) }
        );
        return { output: { projects: data } };
      }

      case 'createProject': {
        const { workspaceId, name, color, clientId } = params;
        if (!workspaceId || !name) return { error: 'workspaceId and name are required' };
        const body: Record<string, any> = { name, workspace_id: Number(workspaceId) };
        if (color) body.color = color;
        if (clientId) body.client_id = clientId;
        const data = await req('POST', `${base}/workspaces/${workspaceId}/projects`, body);
        return { output: data };
      }

      case 'getClients': {
        const { workspaceId } = params;
        if (!workspaceId) return { error: 'workspaceId is required' };
        const data = await req('GET', `${base}/workspaces/${workspaceId}/clients`);
        return { output: { clients: data } };
      }

      case 'createClient': {
        const { workspaceId, name } = params;
        if (!workspaceId || !name) return { error: 'workspaceId and name are required' };
        const data = await req('POST', `${base}/workspaces/${workspaceId}/clients`, {
          name,
          wid: Number(workspaceId),
        });
        return { output: data };
      }

      case 'startTimer': {
        const { workspaceId, description, projectId, tags } = params;
        if (!workspaceId) return { error: 'workspaceId is required' };
        const body: Record<string, any> = {
          workspace_id: Number(workspaceId),
          start: new Date().toISOString(),
          duration: -1,
          created_with: 'sabflow',
        };
        if (description) body.description = description;
        if (projectId) body.project_id = Number(projectId);
        if (tags) body.tags = Array.isArray(tags) ? tags : [tags];
        const data = await req('POST', `${base}/workspaces/${workspaceId}/time_entries`, body);
        return { output: data };
      }

      case 'stopTimer': {
        const { workspaceId, timeEntryId } = params;
        if (!workspaceId || !timeEntryId) {
          return { error: 'workspaceId and timeEntryId are required' };
        }
        const data = await req(
          'PATCH',
          `${base}/workspaces/${workspaceId}/time_entries/${timeEntryId}/stop`
        );
        return { output: data };
      }

      case 'getCurrentTimer': {
        const data = await req('GET', `${base}/me/time_entries/current`);
        return { output: data };
      }

      case 'getTimeEntries': {
        const { startDate, endDate } = params;
        const query: Record<string, string> = {};
        if (startDate) query.start_date = startDate;
        if (endDate) query.end_date = endDate;
        const data = await req(
          'GET',
          `${base}/me/time_entries`,
          undefined,
          Object.keys(query).length ? query : undefined
        );
        return { output: { timeEntries: data } };
      }

      case 'createTimeEntry': {
        const { workspaceId, description, start, duration, projectId } = params;
        if (!workspaceId || !start || duration === undefined) {
          return { error: 'workspaceId, start, and duration are required' };
        }
        const body: Record<string, any> = {
          workspace_id: Number(workspaceId),
          start,
          duration: Number(duration),
          created_with: 'sabflow',
        };
        if (description) body.description = description;
        if (projectId) body.project_id = Number(projectId);
        const data = await req('POST', `${base}/workspaces/${workspaceId}/time_entries`, body);
        return { output: data };
      }

      case 'getReports': {
        const { workspaceId, since, until } = params;
        if (!workspaceId || !since || !until) {
          return { error: 'workspaceId, since, and until are required' };
        }
        const data = await req(
          'POST',
          `https://api.track.toggl.com/reports/api/v3/workspace/${workspaceId}/summary/time_entries`,
          { start_date: since, end_date: until }
        );
        return { output: data };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (err: any) {
    return { error: err.message ?? String(err) };
  }
}
