'use server';

export async function executeHarborAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const harborUsername = String(inputs.username ?? '').trim();
        const harborPassword = String(inputs.password ?? '').trim();
        const harborUrl = String(inputs.harborUrl ?? '').trim().replace(/\/$/, '');
        if (!harborUsername) throw new Error('username is required.');
        if (!harborPassword) throw new Error('password is required.');
        if (!harborUrl) throw new Error('harborUrl is required.');

        const basicAuth = Buffer.from(`${harborUsername}:${harborPassword}`).toString('base64');
        const base = `${harborUrl}/api/v2.0`;

        async function harborFetch(method: string, path: string, body?: any): Promise<any> {
            logger?.log(`[Harbor] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${base}${path}`, options);
            if (res.status === 201 || res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || data?.message || `Harbor API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listProjects': {
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 25);
                const data = await harborFetch('GET', `/projects?page=${page}&page_size=${pageSize}`);
                const projects = Array.isArray(data) ? data : [];
                return { output: { projects, count: projects.length } };
            }

            case 'getProject': {
                const projectName = String(inputs.projectName ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                const data = await harborFetch('GET', `/projects/${projectName}`);
                return { output: { id: data.id, name: data.name, public: data.metadata?.public === 'true', repoCount: data.repo_count ?? 0 } };
            }

            case 'createProject': {
                const projectName = String(inputs.projectName ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                const isPublic = inputs.isPublic === true || inputs.isPublic === 'true';
                await harborFetch('POST', '/projects', { project_name: projectName, metadata: { public: isPublic ? 'true' : 'false' } });
                return { output: { created: true, projectName } };
            }

            case 'deleteProject': {
                const projectName = String(inputs.projectName ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                await harborFetch('DELETE', `/projects/${projectName}`);
                return { output: { deleted: true, projectName } };
            }

            case 'listRepositories': {
                const projectName = String(inputs.projectName ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 25);
                const data = await harborFetch('GET', `/projects/${projectName}/repositories?page=${page}&page_size=${pageSize}`);
                const repos = Array.isArray(data) ? data : [];
                return { output: { repositories: repos, count: repos.length } };
            }

            case 'getRepository': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                const data = await harborFetch('GET', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}`);
                return { output: { name: data.name, pullCount: data.pull_count ?? 0, artifactCount: data.artifact_count ?? 0 } };
            }

            case 'deleteRepository': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                await harborFetch('DELETE', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}`);
                return { output: { deleted: true, projectName, repositoryName } };
            }

            case 'listArtifacts': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 25);
                const data = await harborFetch('GET', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts?page=${page}&page_size=${pageSize}`);
                const artifacts = Array.isArray(data) ? data : [];
                return { output: { artifacts, count: artifacts.length } };
            }

            case 'getArtifact': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                const reference = String(inputs.reference ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                if (!reference) throw new Error('reference is required.');
                const data = await harborFetch('GET', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}`);
                return { output: { digest: data.digest, size: data.size, type: data.type, tags: data.tags ?? [] } };
            }

            case 'deleteArtifact': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                const reference = String(inputs.reference ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                if (!reference) throw new Error('reference is required.');
                await harborFetch('DELETE', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}`);
                return { output: { deleted: true, reference } };
            }

            case 'listTags': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                const reference = String(inputs.reference ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                if (!reference) throw new Error('reference is required.');
                const data = await harborFetch('GET', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}/tags`);
                const tags = Array.isArray(data) ? data : [];
                return { output: { tags, count: tags.length } };
            }

            case 'addTag': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                const reference = String(inputs.reference ?? '').trim();
                const tagName = String(inputs.tagName ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                if (!reference) throw new Error('reference is required.');
                if (!tagName) throw new Error('tagName is required.');
                await harborFetch('POST', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}/tags`, { name: tagName });
                return { output: { added: true, tagName } };
            }

            case 'deleteTag': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                const reference = String(inputs.reference ?? '').trim();
                const tagName = String(inputs.tagName ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                if (!reference) throw new Error('reference is required.');
                if (!tagName) throw new Error('tagName is required.');
                await harborFetch('DELETE', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}/tags/${tagName}`);
                return { output: { deleted: true, tagName } };
            }

            case 'scanArtifact': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                const reference = String(inputs.reference ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                if (!reference) throw new Error('reference is required.');
                await harborFetch('POST', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}/scan`);
                return { output: { scanStarted: true, reference } };
            }

            case 'listVulnerabilities': {
                const projectName = String(inputs.projectName ?? '').trim();
                const repositoryName = String(inputs.repositoryName ?? '').trim();
                const reference = String(inputs.reference ?? '').trim();
                if (!projectName) throw new Error('projectName is required.');
                if (!repositoryName) throw new Error('repositoryName is required.');
                if (!reference) throw new Error('reference is required.');
                const data = await harborFetch('GET', `/projects/${projectName}/repositories/${encodeURIComponent(repositoryName)}/artifacts/${reference}/additions/vulnerabilities`);
                const report = data?.['application/vnd.security.vulnerability.report; version=1.1'] ?? data ?? {};
                const vulns = report.vulnerabilities ?? [];
                return { output: { vulnerabilities: vulns, count: vulns.length, severity: report.severity ?? 'Unknown' } };
            }

            default:
                return { error: `Harbor action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Harbor action failed.' };
    }
}
