'use server';

export async function executeSisenseAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const baseUrl = `${inputs.host}/api/v1`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${inputs.token}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'listDashboards': {
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        if (inputs.sort) params.set('sort', inputs.sort);
        if (inputs.skip) params.set('skip', String(inputs.skip));
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseUrl}/dashboards?${params}`, { headers });
        if (!res.ok) return { error: `listDashboards failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDashboard': {
        const res = await fetch(`${baseUrl}/dashboards/${inputs.dashboardId}`, { headers });
        if (!res.ok) return { error: `getDashboard failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createDashboard': {
        const body: Record<string, any> = { title: inputs.title };
        if (inputs.desc) body.desc = inputs.desc;
        if (inputs.type) body.type = inputs.type;
        const res = await fetch(`${baseUrl}/dashboards`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createDashboard failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'updateDashboard': {
        const body: Record<string, any> = {};
        if (inputs.title) body.title = inputs.title;
        if (inputs.desc) body.desc = inputs.desc;
        const res = await fetch(`${baseUrl}/dashboards/${inputs.dashboardId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `updateDashboard failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'deleteDashboard': {
        const res = await fetch(`${baseUrl}/dashboards/${inputs.dashboardId}`, {
          method: 'DELETE',
          headers,
        });
        if (!res.ok) return { error: `deleteDashboard failed: ${res.status} ${await res.text()}` };
        return { output: { success: true, dashboardId: inputs.dashboardId } };
      }

      case 'exportDashboard': {
        const params = new URLSearchParams();
        if (inputs.format) params.set('format', inputs.format);
        const res = await fetch(`${baseUrl}/dashboards/${inputs.dashboardId}/export?${params}`, { headers });
        if (!res.ok) return { error: `exportDashboard failed: ${res.status} ${await res.text()}` };
        const data = await res.arrayBuffer();
        return { output: { data: Buffer.from(data).toString('base64'), format: inputs.format || 'pdf' } };
      }

      case 'listWidgets': {
        const res = await fetch(`${baseUrl}/dashboards/${inputs.dashboardId}/widgets`, { headers });
        if (!res.ok) return { error: `listWidgets failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getWidget': {
        const res = await fetch(`${baseUrl}/dashboards/${inputs.dashboardId}/widgets/${inputs.widgetId}`, { headers });
        if (!res.ok) return { error: `getWidget failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createWidget': {
        const res = await fetch(`${baseUrl}/dashboards/${inputs.dashboardId}/widgets`, {
          method: 'POST',
          headers,
          body: JSON.stringify(inputs.widget || {}),
        });
        if (!res.ok) return { error: `createWidget failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listDataSources': {
        const params = new URLSearchParams();
        if (inputs.type) params.set('type', inputs.type);
        const res = await fetch(`${baseUrl}/datasources?${params}`, { headers });
        if (!res.ok) return { error: `listDataSources failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDataSource': {
        const res = await fetch(`${baseUrl}/datasources/${encodeURIComponent(inputs.dataSourceId)}`, { headers });
        if (!res.ok) return { error: `getDataSource failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listGroups': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.skip) params.set('skip', String(inputs.skip));
        const res = await fetch(`${baseUrl}/groups?${params}`, { headers });
        if (!res.ok) return { error: `listGroups failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getGroup': {
        const res = await fetch(`${baseUrl}/groups/${inputs.groupId}`, { headers });
        if (!res.ok) return { error: `getGroup failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.skip) params.set('skip', String(inputs.skip));
        if (inputs.role) params.set('role', inputs.role);
        const res = await fetch(`${baseUrl}/users?${params}`, { headers });
        if (!res.ok) return { error: `listUsers failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createUser': {
        const body: Record<string, any> = {
          email: inputs.email,
          username: inputs.username,
          firstName: inputs.firstName,
          lastName: inputs.lastName,
          roleId: inputs.roleId,
        };
        if (inputs.password) body.password = inputs.password;
        const res = await fetch(`${baseUrl}/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createUser failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Sisense action: ${actionName}` };
    }
  } catch (err: any) {
    return { error: err?.message || 'Sisense action failed' };
  }
}
