'use server';

const DOCKER_HUB_BASE = 'https://hub.docker.com/v2';

export async function executeDockerHubAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const username = String(inputs.username ?? '').trim();
        const password = String(inputs.password ?? '').trim();
        if (!username) throw new Error('username is required.');
        if (!password) throw new Error('password is required.');

        // Obtain JWT token
        logger?.log('[DockerHub] Authenticating...');
        const loginRes = await fetch(`${DOCKER_HUB_BASE}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData?.message || `DockerHub login failed: ${loginRes.status}`);
        const jwtToken = loginData.token as string;

        async function dhFetch(method: string, path: string, body?: any): Promise<any> {
            logger?.log(`[DockerHub] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${DOCKER_HUB_BASE}${path}`, options);
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.message || data?.detail || `DockerHub API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listRepositories': {
                const namespace = String(inputs.namespace ?? username).trim();
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 25);
                const data = await dhFetch('GET', `/repositories/${namespace}/?page=${page}&page_size=${pageSize}`);
                return { output: { repositories: data.results ?? [], count: data.count ?? 0, next: data.next ?? null } };
            }

            case 'getRepository': {
                const namespace = String(inputs.namespace ?? username).trim();
                const repoName = String(inputs.repoName ?? '').trim();
                if (!repoName) throw new Error('repoName is required.');
                const data = await dhFetch('GET', `/repositories/${namespace}/${repoName}/`);
                return { output: { name: data.name, namespace: data.namespace, description: data.description ?? '', isPrivate: data.is_private, pullCount: data.pull_count, starCount: data.star_count } };
            }

            case 'createRepository': {
                const namespace = String(inputs.namespace ?? username).trim();
                const repoName = String(inputs.repoName ?? '').trim();
                const description = String(inputs.description ?? '');
                const isPrivate = inputs.isPrivate === true || inputs.isPrivate === 'true';
                if (!repoName) throw new Error('repoName is required.');
                const data = await dhFetch('POST', '/repositories/', { namespace, name: repoName, description, is_private: isPrivate });
                return { output: { name: data.name, namespace: data.namespace, isPrivate: data.is_private } };
            }

            case 'updateRepository': {
                const namespace = String(inputs.namespace ?? username).trim();
                const repoName = String(inputs.repoName ?? '').trim();
                if (!repoName) throw new Error('repoName is required.');
                const body: any = {};
                if (inputs.description !== undefined) body.description = String(inputs.description);
                if (inputs.fullDescription !== undefined) body.full_description = String(inputs.fullDescription);
                const data = await dhFetch('PATCH', `/repositories/${namespace}/${repoName}/`, body);
                return { output: { name: data.name, namespace: data.namespace, description: data.description ?? '' } };
            }

            case 'deleteRepository': {
                const namespace = String(inputs.namespace ?? username).trim();
                const repoName = String(inputs.repoName ?? '').trim();
                if (!repoName) throw new Error('repoName is required.');
                await dhFetch('DELETE', `/repositories/${namespace}/${repoName}/`);
                return { output: { deleted: true, repoName, namespace } };
            }

            case 'listTags': {
                const namespace = String(inputs.namespace ?? username).trim();
                const repoName = String(inputs.repoName ?? '').trim();
                if (!repoName) throw new Error('repoName is required.');
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 25);
                const data = await dhFetch('GET', `/repositories/${namespace}/${repoName}/tags/?page=${page}&page_size=${pageSize}`);
                return { output: { tags: data.results ?? [], count: data.count ?? 0 } };
            }

            case 'getTag': {
                const namespace = String(inputs.namespace ?? username).trim();
                const repoName = String(inputs.repoName ?? '').trim();
                const tag = String(inputs.tag ?? '').trim();
                if (!repoName) throw new Error('repoName is required.');
                if (!tag) throw new Error('tag is required.');
                const data = await dhFetch('GET', `/repositories/${namespace}/${repoName}/tags/${tag}/`);
                return { output: { name: data.name, fullSize: data.full_size, lastUpdated: data.last_updated, digest: data.digest ?? '' } };
            }

            case 'deleteTag': {
                const namespace = String(inputs.namespace ?? username).trim();
                const repoName = String(inputs.repoName ?? '').trim();
                const tag = String(inputs.tag ?? '').trim();
                if (!repoName) throw new Error('repoName is required.');
                if (!tag) throw new Error('tag is required.');
                await dhFetch('DELETE', `/repositories/${namespace}/${repoName}/tags/${tag}/`);
                return { output: { deleted: true, tag, repoName, namespace } };
            }

            case 'listOrganizations': {
                const data = await dhFetch('GET', `/user/orgs/?page_size=100`);
                return { output: { organizations: data.results ?? [], count: data.count ?? 0 } };
            }

            case 'getOrganization': {
                const orgName = String(inputs.orgName ?? '').trim();
                if (!orgName) throw new Error('orgName is required.');
                const data = await dhFetch('GET', `/orgs/${orgName}/`);
                return { output: { orgName: data.orgname, fullName: data.full_name ?? '', company: data.company ?? '', location: data.location ?? '' } };
            }

            case 'listTeams': {
                const orgName = String(inputs.orgName ?? '').trim();
                if (!orgName) throw new Error('orgName is required.');
                const data = await dhFetch('GET', `/orgs/${orgName}/groups/?page_size=100`);
                return { output: { teams: data.results ?? [], count: data.count ?? 0 } };
            }

            case 'getTeam': {
                const orgName = String(inputs.orgName ?? '').trim();
                const teamName = String(inputs.teamName ?? '').trim();
                if (!orgName) throw new Error('orgName is required.');
                if (!teamName) throw new Error('teamName is required.');
                const data = await dhFetch('GET', `/orgs/${orgName}/groups/${teamName}/`);
                return { output: { id: data.id, name: data.name, description: data.description ?? '', memberCount: data.member_count ?? 0 } };
            }

            case 'searchRepositories': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 25);
                const data = await dhFetch('GET', `/search/repositories/?query=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`);
                return { output: { results: data.results ?? [], count: data.count ?? 0 } };
            }

            case 'getRepositoryStats': {
                const namespace = String(inputs.namespace ?? username).trim();
                const repoName = String(inputs.repoName ?? '').trim();
                if (!repoName) throw new Error('repoName is required.');
                const data = await dhFetch('GET', `/repositories/${namespace}/${repoName}/`);
                return { output: { pullCount: data.pull_count ?? 0, starCount: data.star_count ?? 0, collaboratorCount: data.collaborator_count ?? 0, lastUpdated: data.last_updated ?? '' } };
            }

            case 'getDockerfileFromRepository': {
                const namespace = String(inputs.namespace ?? username).trim();
                const repoName = String(inputs.repoName ?? '').trim();
                if (!repoName) throw new Error('repoName is required.');
                const data = await dhFetch('GET', `/repositories/${namespace}/${repoName}/dockerfile/`);
                return { output: { contents: data.contents ?? '' } };
            }

            default:
                return { error: `DockerHub action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'DockerHub action failed.' };
    }
}
