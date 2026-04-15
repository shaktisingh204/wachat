'use server';

export async function executeKubernetesAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        const apiServer = String(inputs.apiServer ?? '').trim();
        if (!token) throw new Error('token is required.');
        if (!apiServer) throw new Error('apiServer is required.');

        const base = apiServer.replace(/\/$/, '');

        async function k8sFetch(method: string, path: string, body?: any): Promise<any> {
            logger?.log(`[Kubernetes] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${base}${path}`, options);
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.message || `Kubernetes API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listPods': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const data = await k8sFetch('GET', `/api/v1/namespaces/${namespace}/pods`);
                const pods = data?.items ?? [];
                return { output: { pods, count: pods.length } };
            }

            case 'getPod': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const podName = String(inputs.podName ?? '').trim();
                if (!podName) throw new Error('podName is required.');
                const data = await k8sFetch('GET', `/api/v1/namespaces/${namespace}/pods/${podName}`);
                return { output: { name: data.metadata?.name, namespace: data.metadata?.namespace, status: data.status?.phase, labels: data.metadata?.labels ?? {} } };
            }

            case 'deletePod': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const podName = String(inputs.podName ?? '').trim();
                if (!podName) throw new Error('podName is required.');
                await k8sFetch('DELETE', `/api/v1/namespaces/${namespace}/pods/${podName}`);
                return { output: { deleted: true, podName, namespace } };
            }

            case 'listDeployments': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const data = await k8sFetch('GET', `/apis/apps/v1/namespaces/${namespace}/deployments`);
                const deployments = data?.items ?? [];
                return { output: { deployments, count: deployments.length } };
            }

            case 'getDeployment': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const deploymentName = String(inputs.deploymentName ?? '').trim();
                if (!deploymentName) throw new Error('deploymentName is required.');
                const data = await k8sFetch('GET', `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`);
                return { output: { name: data.metadata?.name, namespace: data.metadata?.namespace, replicas: data.spec?.replicas, readyReplicas: data.status?.readyReplicas ?? 0 } };
            }

            case 'createDeployment': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const manifest = inputs.manifest;
                if (!manifest) throw new Error('manifest is required.');
                const body = typeof manifest === 'string' ? JSON.parse(manifest) : manifest;
                const data = await k8sFetch('POST', `/apis/apps/v1/namespaces/${namespace}/deployments`, body);
                return { output: { name: data.metadata?.name, namespace: data.metadata?.namespace, uid: data.metadata?.uid } };
            }

            case 'updateDeployment': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const deploymentName = String(inputs.deploymentName ?? '').trim();
                if (!deploymentName) throw new Error('deploymentName is required.');
                const manifest = inputs.manifest;
                if (!manifest) throw new Error('manifest is required.');
                const body = typeof manifest === 'string' ? JSON.parse(manifest) : manifest;
                const data = await k8sFetch('PUT', `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`, body);
                return { output: { name: data.metadata?.name, namespace: data.metadata?.namespace, replicas: data.spec?.replicas } };
            }

            case 'scaleDeployment': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const deploymentName = String(inputs.deploymentName ?? '').trim();
                const replicas = Number(inputs.replicas ?? 1);
                if (!deploymentName) throw new Error('deploymentName is required.');
                const scaleBody = { spec: { replicas } };
                const data = await k8sFetch('PATCH', `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}/scale`, scaleBody);
                return { output: { deploymentName, namespace, replicas: data.spec?.replicas } };
            }

            case 'deleteDeployment': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const deploymentName = String(inputs.deploymentName ?? '').trim();
                if (!deploymentName) throw new Error('deploymentName is required.');
                await k8sFetch('DELETE', `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`);
                return { output: { deleted: true, deploymentName, namespace } };
            }

            case 'listServices': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const data = await k8sFetch('GET', `/api/v1/namespaces/${namespace}/services`);
                const services = data?.items ?? [];
                return { output: { services, count: services.length } };
            }

            case 'getService': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const serviceName = String(inputs.serviceName ?? '').trim();
                if (!serviceName) throw new Error('serviceName is required.');
                const data = await k8sFetch('GET', `/api/v1/namespaces/${namespace}/services/${serviceName}`);
                return { output: { name: data.metadata?.name, namespace: data.metadata?.namespace, type: data.spec?.type, clusterIP: data.spec?.clusterIP, ports: data.spec?.ports ?? [] } };
            }

            case 'createService': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const manifest = inputs.manifest;
                if (!manifest) throw new Error('manifest is required.');
                const body = typeof manifest === 'string' ? JSON.parse(manifest) : manifest;
                const data = await k8sFetch('POST', `/api/v1/namespaces/${namespace}/services`, body);
                return { output: { name: data.metadata?.name, namespace: data.metadata?.namespace, clusterIP: data.spec?.clusterIP } };
            }

            case 'listNamespaces': {
                const data = await k8sFetch('GET', '/api/v1/namespaces');
                const namespaces = data?.items ?? [];
                return { output: { namespaces: namespaces.map((n: any) => ({ name: n.metadata?.name, status: n.status?.phase })), count: namespaces.length } };
            }

            case 'createNamespace': {
                const namespaceName = String(inputs.namespaceName ?? '').trim();
                if (!namespaceName) throw new Error('namespaceName is required.');
                const body = { apiVersion: 'v1', kind: 'Namespace', metadata: { name: namespaceName } };
                const data = await k8sFetch('POST', '/api/v1/namespaces', body);
                return { output: { name: data.metadata?.name, status: data.status?.phase } };
            }

            case 'listConfigMaps': {
                const namespace = String(inputs.namespace ?? 'default').trim();
                const data = await k8sFetch('GET', `/api/v1/namespaces/${namespace}/configmaps`);
                const configMaps = data?.items ?? [];
                return { output: { configMaps, count: configMaps.length } };
            }

            default:
                return { error: `Kubernetes action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Kubernetes action failed.' };
    }
}
