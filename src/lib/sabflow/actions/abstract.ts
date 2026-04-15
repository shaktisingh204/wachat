'use server';

export async function executeAbstractAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.goabstract.com/abstract-api/v2';
    const token = inputs.accessToken;

    try {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listOrganizations':
                url = `${BASE}/organizations`;
                break;

            case 'getOrganization':
                url = `${BASE}/organizations/${inputs.organizationId}`;
                break;

            case 'listProjects':
                url = `${BASE}/projects`;
                if (inputs.organizationId) url += `?organizationId=${inputs.organizationId}`;
                break;

            case 'getProject':
                url = `${BASE}/projects/${inputs.projectId}`;
                break;

            case 'listBranches':
                url = `${BASE}/branches`;
                if (inputs.projectId) url += `?projectId=${inputs.projectId}`;
                break;

            case 'getBranch':
                url = `${BASE}/branches/${inputs.branchId}`;
                if (inputs.projectId) url += `?projectId=${inputs.projectId}`;
                break;

            case 'createBranch':
                url = `${BASE}/branches`;
                method = 'POST';
                body = JSON.stringify({
                    projectId: inputs.projectId,
                    name: inputs.name,
                    description: inputs.description || '',
                    parent: inputs.parent || 'master',
                });
                break;

            case 'listCommits':
                url = `${BASE}/commits`;
                if (inputs.projectId) url += `?projectId=${inputs.projectId}`;
                if (inputs.branchId) url += `${url.includes('?') ? '&' : '?'}branchId=${inputs.branchId}`;
                break;

            case 'getCommit':
                url = `${BASE}/commits/${inputs.sha}`;
                if (inputs.projectId) url += `?projectId=${inputs.projectId}`;
                break;

            case 'listFiles':
                url = `${BASE}/files`;
                if (inputs.projectId) url += `?projectId=${inputs.projectId}`;
                if (inputs.branchId) url += `${url.includes('?') ? '&' : '?'}branchId=${inputs.branchId}`;
                break;

            case 'getFile':
                url = `${BASE}/files/${inputs.fileId}`;
                if (inputs.projectId) url += `?projectId=${inputs.projectId}`;
                break;

            case 'listCollections':
                url = `${BASE}/collections`;
                if (inputs.projectId) url += `?projectId=${inputs.projectId}`;
                break;

            case 'getCollection':
                url = `${BASE}/collections/${inputs.collectionId}`;
                break;

            case 'createCollection':
                url = `${BASE}/collections`;
                method = 'POST';
                body = JSON.stringify({
                    projectId: inputs.projectId,
                    branchId: inputs.branchId || 'master',
                    name: inputs.name,
                    description: inputs.description || '',
                    published: inputs.published || false,
                });
                break;

            case 'listMemberships':
                url = `${BASE}/memberships`;
                if (inputs.organizationId) url += `?organizationId=${inputs.organizationId}`;
                if (inputs.projectId) url += `${url.includes('?') ? '&' : '?'}projectId=${inputs.projectId}`;
                break;

            default:
                return { error: `Unknown Abstract action: ${actionName}` };
        }

        const response = await fetch(url, {
            method,
            headers,
            ...(body ? { body } : {}),
        });

        if (response.status === 204) {
            logger.log(`Abstract [${actionName}] succeeded (no content)`);
            return { output: { success: true } };
        }

        const data = await response.json();

        if (!response.ok) {
            logger.log(`Abstract API error [${actionName}]: ${response.status}`, data);
            return { error: data.message || data.detail || `Abstract API error: ${response.status}` };
        }

        logger.log(`Abstract [${actionName}] succeeded`);
        return { output: data };
    } catch (err: any) {
        logger.log(`Abstract action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Abstract action failed' };
    }
}
