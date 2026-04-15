'use server';

async function getLookerAccessToken(inputs: any): Promise<string> {
  const res = await fetch(`${inputs.baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: inputs.clientId,
      client_secret: inputs.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Looker login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function executeLookerEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const accessToken = await getLookerAccessToken(inputs);
    const baseUrl = inputs.baseUrl;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    switch (actionName) {
      case 'runLook': {
        const params = new URLSearchParams();
        if (inputs.resultFormat) params.set('result_format', inputs.resultFormat);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseUrl}/looks/${inputs.lookId}/run/${inputs.resultFormat || 'json'}?${params}`, { headers });
        if (!res.ok) return { error: `runLook failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'runInlineQuery': {
        const body: Record<string, any> = {
          model: inputs.model,
          view: inputs.view,
          fields: inputs.fields || [],
          filters: inputs.filters || {},
          sorts: inputs.sorts || [],
          limit: inputs.limit || '500',
        };
        const format = inputs.resultFormat || 'json';
        const res = await fetch(`${baseUrl}/queries/run/${format}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `runInlineQuery failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'runSavedQuery': {
        const format = inputs.resultFormat || 'json';
        const res = await fetch(`${baseUrl}/queries/${inputs.queryId}/run/${format}`, { headers });
        if (!res.ok) return { error: `runSavedQuery failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listLooks': {
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        const res = await fetch(`${baseUrl}/looks?${params}`, { headers });
        if (!res.ok) return { error: `listLooks failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getLook': {
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        const res = await fetch(`${baseUrl}/looks/${inputs.lookId}?${params}`, { headers });
        if (!res.ok) return { error: `getLook failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listDashboards': {
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        const res = await fetch(`${baseUrl}/dashboards?${params}`, { headers });
        if (!res.ok) return { error: `listDashboards failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDashboard': {
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        const res = await fetch(`${baseUrl}/dashboards/${inputs.dashboardId}?${params}`, { headers });
        if (!res.ok) return { error: `getDashboard failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listUsers': {
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        if (inputs.limit) params.set('limit', String(inputs.limit));
        if (inputs.offset) params.set('offset', String(inputs.offset));
        const res = await fetch(`${baseUrl}/users?${params}`, { headers });
        if (!res.ok) return { error: `listUsers failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getUser': {
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        const res = await fetch(`${baseUrl}/users/${inputs.userId}?${params}`, { headers });
        if (!res.ok) return { error: `getUser failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createUser': {
        const body: Record<string, any> = {};
        if (inputs.firstName) body.first_name = inputs.firstName;
        if (inputs.lastName) body.last_name = inputs.lastName;
        if (inputs.email) body.email = inputs.email;
        if (inputs.isDisabled !== undefined) body.is_disabled = inputs.isDisabled;
        const res = await fetch(`${baseUrl}/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createUser failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listDimensions': {
        const params = new URLSearchParams();
        params.set('model_name', inputs.modelName);
        params.set('view_name', inputs.viewName);
        if (inputs.fields) params.set('fields', inputs.fields);
        const res = await fetch(`${baseUrl}/lookml_models/${inputs.modelName}/explores/${inputs.exploreName}?${params}`, { headers });
        if (!res.ok) return { error: `listDimensions failed: ${res.status} ${await res.text()}` };
        const data = await res.json();
        return { output: { dimensions: data.fields?.dimensions || [] } };
      }

      case 'listExplores': {
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        const res = await fetch(`${baseUrl}/lookml_models/${inputs.modelName}?${params}`, { headers });
        if (!res.ok) return { error: `listExplores failed: ${res.status} ${await res.text()}` };
        const data = await res.json();
        return { output: { explores: data.explores || [] } };
      }

      case 'getExplore': {
        const params = new URLSearchParams();
        if (inputs.fields) params.set('fields', inputs.fields);
        const res = await fetch(`${baseUrl}/lookml_models/${inputs.modelName}/explores/${inputs.exploreName}?${params}`, { headers });
        if (!res.ok) return { error: `getExplore failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'runDashboard': {
        const body: Record<string, any> = {
          dashboard_id: inputs.dashboardId,
          filters: inputs.filters || {},
        };
        const res = await fetch(`${baseUrl}/dashboard_elements/${inputs.dashboardId}/query_results`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `runDashboard failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'scheduleReport': {
        const body: Record<string, any> = {
          name: inputs.name,
          crontab: inputs.crontab,
          scheduled_plan_destination: inputs.destinations || [],
        };
        if (inputs.lookId) body.look_id = inputs.lookId;
        if (inputs.dashboardId) body.dashboard_id = inputs.dashboardId;
        if (inputs.lookmlDashboardId) body.lookml_dashboard_id = inputs.lookmlDashboardId;
        const res = await fetch(`${baseUrl}/scheduled_plans`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `scheduleReport failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Looker Enhanced action: ${actionName}` };
    }
  } catch (err: any) {
    return { error: err?.message || 'Looker Enhanced action failed' };
  }
}
