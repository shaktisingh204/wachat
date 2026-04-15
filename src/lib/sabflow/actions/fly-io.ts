'use server';

const FLY_IO_BASE = 'https://api.machines.dev/v1';

export async function executeFlyIoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');

        async function flyFetch(method: string, path: string, body?: any): Promise<any> {
            logger?.log(`[Fly.io] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${FLY_IO_BASE}${path}`, options);
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.error || data?.message || `Fly.io API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listApps': {
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                const path = orgSlug ? `/apps?org_slug=${encodeURIComponent(orgSlug)}` : '/apps';
                const data = await flyFetch('GET', path);
                const apps = data?.apps ?? (Array.isArray(data) ? data : []);
                return { output: { apps, count: apps.length } };
            }

            case 'getApp': {
                const appName = String(inputs.appName ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                const data = await flyFetch('GET', `/apps/${appName}`);
                return { output: { id: data.id, name: data.name, status: data.status, organization: data.organization?.slug ?? '' } };
            }

            case 'createApp': {
                const appName = String(inputs.appName ?? '').trim();
                const orgSlug = String(inputs.orgSlug ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                if (!orgSlug) throw new Error('orgSlug is required.');
                const data = await flyFetch('POST', '/apps', { app_name: appName, org_slug: orgSlug });
                return { output: { id: data.id, name: data.name ?? appName } };
            }

            case 'updateApp': {
                const appName = String(inputs.appName ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                const body: any = {};
                if (inputs.autoDestroy !== undefined) body.auto_destroy = inputs.autoDestroy === true || inputs.autoDestroy === 'true';
                const data = await flyFetch('POST', `/apps/${appName}`, body);
                return { output: { name: data.name ?? appName, updated: true } };
            }

            case 'deleteApp': {
                const appName = String(inputs.appName ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                await flyFetch('DELETE', `/apps/${appName}`);
                return { output: { deleted: true, appName } };
            }

            case 'listMachines': {
                const appName = String(inputs.appName ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                const data = await flyFetch('GET', `/apps/${appName}/machines`);
                const machines = Array.isArray(data) ? data : [];
                return { output: { machines, count: machines.length } };
            }

            case 'getMachine': {
                const appName = String(inputs.appName ?? '').trim();
                const machineId = String(inputs.machineId ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                if (!machineId) throw new Error('machineId is required.');
                const data = await flyFetch('GET', `/apps/${appName}/machines/${machineId}`);
                return { output: { id: data.id, name: data.name, state: data.state, region: data.region, image: data.config?.image ?? '' } };
            }

            case 'createMachine': {
                const appName = String(inputs.appName ?? '').trim();
                const image = String(inputs.image ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                if (!image) throw new Error('image is required.');
                const region = String(inputs.region ?? '').trim();
                const config: any = { image };
                if (inputs.env) config.env = inputs.env;
                if (inputs.guest) config.guest = inputs.guest;
                const body: any = { config };
                if (region) body.region = region;
                if (inputs.name) body.name = String(inputs.name).trim();
                const data = await flyFetch('POST', `/apps/${appName}/machines`, body);
                return { output: { id: data.id, name: data.name, state: data.state, region: data.region } };
            }

            case 'startMachine': {
                const appName = String(inputs.appName ?? '').trim();
                const machineId = String(inputs.machineId ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                if (!machineId) throw new Error('machineId is required.');
                await flyFetch('POST', `/apps/${appName}/machines/${machineId}/start`);
                return { output: { started: true, machineId } };
            }

            case 'stopMachine': {
                const appName = String(inputs.appName ?? '').trim();
                const machineId = String(inputs.machineId ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                if (!machineId) throw new Error('machineId is required.');
                await flyFetch('POST', `/apps/${appName}/machines/${machineId}/stop`);
                return { output: { stopped: true, machineId } };
            }

            case 'restartMachine': {
                const appName = String(inputs.appName ?? '').trim();
                const machineId = String(inputs.machineId ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                if (!machineId) throw new Error('machineId is required.');
                await flyFetch('POST', `/apps/${appName}/machines/${machineId}/restart`);
                return { output: { restarted: true, machineId } };
            }

            case 'destroyMachine': {
                const appName = String(inputs.appName ?? '').trim();
                const machineId = String(inputs.machineId ?? '').trim();
                const force = inputs.force === true || inputs.force === 'true';
                if (!appName) throw new Error('appName is required.');
                if (!machineId) throw new Error('machineId is required.');
                await flyFetch('DELETE', `/apps/${appName}/machines/${machineId}${force ? '?force=true' : ''}`);
                return { output: { destroyed: true, machineId } };
            }

            case 'listVolumes': {
                const appName = String(inputs.appName ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                const data = await flyFetch('GET', `/apps/${appName}/volumes`);
                const volumes = Array.isArray(data) ? data : [];
                return { output: { volumes, count: volumes.length } };
            }

            case 'createVolume': {
                const appName = String(inputs.appName ?? '').trim();
                const volumeName = String(inputs.volumeName ?? '').trim();
                const region = String(inputs.region ?? '').trim();
                const sizeGb = Number(inputs.sizeGb ?? 1);
                if (!appName) throw new Error('appName is required.');
                if (!volumeName) throw new Error('volumeName is required.');
                if (!region) throw new Error('region is required.');
                const data = await flyFetch('POST', `/apps/${appName}/volumes`, { name: volumeName, region, size_gb: sizeGb });
                return { output: { id: data.id, name: data.name, region: data.region, sizeGb: data.size_gb, state: data.state } };
            }

            case 'deleteVolume': {
                const appName = String(inputs.appName ?? '').trim();
                const volumeId = String(inputs.volumeId ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                if (!volumeId) throw new Error('volumeId is required.');
                await flyFetch('DELETE', `/apps/${appName}/volumes/${volumeId}`);
                return { output: { deleted: true, volumeId } };
            }

            default:
                return { error: `Fly.io action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Fly.io action failed.' };
    }
}
