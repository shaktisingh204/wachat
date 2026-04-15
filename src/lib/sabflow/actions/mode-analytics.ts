'use server';

export async function executeModeAnalyticsAction(actionName: string, inputs: any, user: any, logger: any) {
  try {
    const token = Buffer.from(inputs.token + ':' + inputs.password).toString('base64');
    const baseUrl = `https://app.mode.com/api/${inputs.workspace}`;
    const headers: Record<string, string> = {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    switch (actionName) {
      case 'listReports': {
        const res = await fetch(`${baseUrl}/reports`, { headers });
        if (!res.ok) return { error: `listReports failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getReport': {
        const res = await fetch(`${baseUrl}/reports/${inputs.reportToken}`, { headers });
        if (!res.ok) return { error: `getReport failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createReport': {
        const body: Record<string, any> = { report: { name: inputs.name, description: inputs.description } };
        if (inputs.spaceToken) body.report.space_token = inputs.spaceToken;
        const res = await fetch(`${baseUrl}/reports`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createReport failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'runReport': {
        const res = await fetch(`${baseUrl}/reports/${inputs.reportToken}/runs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ run: { parameters: inputs.parameters || {} } }),
        });
        if (!res.ok) return { error: `runReport failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listReportRuns': {
        const res = await fetch(`${baseUrl}/reports/${inputs.reportToken}/runs`, { headers });
        if (!res.ok) return { error: `listReportRuns failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getReportRun': {
        const res = await fetch(`${baseUrl}/reports/${inputs.reportToken}/runs/${inputs.runToken}`, { headers });
        if (!res.ok) return { error: `getReportRun failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listQueries': {
        const res = await fetch(`${baseUrl}/reports/${inputs.reportToken}/queries`, { headers });
        if (!res.ok) return { error: `listQueries failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getQuery': {
        const res = await fetch(`${baseUrl}/reports/${inputs.reportToken}/queries/${inputs.queryToken}`, { headers });
        if (!res.ok) return { error: `getQuery failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'createQuery': {
        const body = { query: { raw_query: inputs.rawQuery, data_source_id: inputs.dataSourceId } };
        const res = await fetch(`${baseUrl}/reports/${inputs.reportToken}/queries`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) return { error: `createQuery failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listSpaces': {
        const res = await fetch(`${baseUrl}/spaces`, { headers });
        if (!res.ok) return { error: `listSpaces failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getSpace': {
        const res = await fetch(`${baseUrl}/spaces/${inputs.spaceToken}`, { headers });
        if (!res.ok) return { error: `getSpace failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listDataSources': {
        const res = await fetch(`${baseUrl}/data_sources`, { headers });
        if (!res.ok) return { error: `listDataSources failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDataSource': {
        const res = await fetch(`${baseUrl}/data_sources/${inputs.dataSourceToken}`, { headers });
        if (!res.ok) return { error: `getDataSource failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'getDataset': {
        const res = await fetch(`${baseUrl}/reports/${inputs.reportToken}/runs/${inputs.runToken}/results/content.json`, { headers });
        if (!res.ok) return { error: `getDataset failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      case 'listCharts': {
        const res = await fetch(`${baseUrl}/reports/${inputs.reportToken}/charts`, { headers });
        if (!res.ok) return { error: `listCharts failed: ${res.status} ${await res.text()}` };
        return { output: await res.json() };
      }

      default:
        return { error: `Unknown Mode Analytics action: ${actionName}` };
    }
  } catch (err: any) {
    return { error: err?.message || 'Mode Analytics action failed' };
  }
}
