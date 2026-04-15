'use server';

export async function executeLookerStudioAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, instance } = inputs;

    // Looker API base (self-hosted or cloud)
    const lookerBase = instance
        ? `https://${instance}.looker.com:19999/api/4.0`
        : 'https://api.looker.com/api/4.0';

    // Looker Studio (Data Studio) API base
    const datastudioBase = 'https://datastudio.googleapis.com/v1';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listReports': {
                const res = await fetch(`${datastudioBase}/reports`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listReports failed' };
                return { output: data };
            }

            case 'getReport': {
                const res = await fetch(`${datastudioBase}/reports/${inputs.reportId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getReport failed' };
                return { output: data };
            }

            case 'createReport': {
                const res = await fetch(`${datastudioBase}/reports`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createReport failed' };
                return { output: data };
            }

            case 'runQuery': {
                const res = await fetch(`${lookerBase}/queries/run/${inputs.resultFormat || 'json'}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'runQuery failed' };
                return { output: data };
            }

            case 'getAllLooks': {
                const params = new URLSearchParams({ fields: inputs.fields || '' });
                const res = await fetch(`${lookerBase}/looks?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'getAllLooks failed' };
                return { output: { looks: data } };
            }

            case 'getLook': {
                const res = await fetch(`${lookerBase}/looks/${inputs.lookId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'getLook failed' };
                return { output: data };
            }

            case 'runLook': {
                const resultFormat = inputs.resultFormat || 'json';
                const res = await fetch(`${lookerBase}/looks/${inputs.lookId}/run/${resultFormat}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'runLook failed' };
                return { output: { results: data } };
            }

            case 'listDashboards': {
                const params = new URLSearchParams({ fields: inputs.fields || '' });
                const res = await fetch(`${lookerBase}/dashboards?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'listDashboards failed' };
                return { output: { dashboards: data } };
            }

            case 'getDashboard': {
                const res = await fetch(`${lookerBase}/dashboards/${inputs.dashboardId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'getDashboard failed' };
                return { output: data };
            }

            case 'getDashboardElement': {
                const res = await fetch(`${lookerBase}/dashboard_elements/${inputs.dashboardElementId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'getDashboardElement failed' };
                return { output: data };
            }

            case 'getAllExplores': {
                const res = await fetch(`${lookerBase}/lookml_models/${inputs.modelName}/explores`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'getAllExplores failed' };
                return { output: { explores: data } };
            }

            case 'getExplore': {
                const res = await fetch(`${lookerBase}/lookml_models/${inputs.modelName}/explores/${inputs.exploreName}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'getExplore failed' };
                return { output: data };
            }

            case 'createQuery': {
                const res = await fetch(`${lookerBase}/queries`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'createQuery failed' };
                return { output: data };
            }

            case 'runInlineQuery': {
                const resultFormat = inputs.resultFormat || 'json';
                const res = await fetch(`${lookerBase}/queries/run/${resultFormat}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'runInlineQuery failed' };
                return { output: { results: data } };
            }

            case 'listFolders': {
                const params = new URLSearchParams({ fields: inputs.fields || '' });
                const res = await fetch(`${lookerBase}/folders?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: (data as any).message || 'listFolders failed' };
                return { output: { folders: data } };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`looker-studio error: ${err.message}`);
        return { error: err.message || 'Unexpected error in looker-studio action' };
    }
}
