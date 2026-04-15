'use server';

export async function executeTerraformCloudAction(actionName: string, inputs: any, user: any, logger: any) {
    const token = inputs.token;
    const baseUrl = 'https://app.terraform.io/api/v2';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/vnd.api+json',
    };

    try {
        switch (actionName) {
            case 'listOrganizations': {
                const res = await fetch(`${baseUrl}/organizations`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { organizations: data.data } };
            }

            case 'getOrganization': {
                const { organizationName } = inputs;
                const res = await fetch(`${baseUrl}/organizations/${organizationName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { organization: data.data } };
            }

            case 'listWorkspaces': {
                const { organizationName, pageSize = 20, pageNumber = 1 } = inputs;
                const res = await fetch(`${baseUrl}/organizations/${organizationName}/workspaces?page[size]=${pageSize}&page[number]=${pageNumber}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { workspaces: data.data, meta: data.meta } };
            }

            case 'getWorkspace': {
                const { organizationName, workspaceName } = inputs;
                const res = await fetch(`${baseUrl}/organizations/${organizationName}/workspaces/${workspaceName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { workspace: data.data } };
            }

            case 'createWorkspace': {
                const { organizationName, name, description, autoApply = false, workingDirectory, vcsRepoIdentifier, oauthTokenId } = inputs;
                const body: any = {
                    data: {
                        type: 'workspaces',
                        attributes: {
                            name,
                            description: description ?? '',
                            'auto-apply': autoApply,
                            'working-directory': workingDirectory ?? '',
                        },
                    },
                };
                if (vcsRepoIdentifier && oauthTokenId) {
                    body.data.attributes['vcs-repo'] = {
                        identifier: vcsRepoIdentifier,
                        'oauth-token-id': oauthTokenId,
                    };
                }
                const res = await fetch(`${baseUrl}/organizations/${organizationName}/workspaces`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { workspace: data.data } };
            }

            case 'updateWorkspace': {
                const { workspaceId, name, description, autoApply } = inputs;
                const attributes: any = {};
                if (name !== undefined) attributes.name = name;
                if (description !== undefined) attributes.description = description;
                if (autoApply !== undefined) attributes['auto-apply'] = autoApply;
                const res = await fetch(`${baseUrl}/workspaces/${workspaceId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ data: { type: 'workspaces', attributes } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { workspace: data.data } };
            }

            case 'deleteWorkspace': {
                const { workspaceId } = inputs;
                const res = await fetch(`${baseUrl}/workspaces/${workspaceId}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { deleted: true, workspaceId } };
                const data = await res.json();
                return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
            }

            case 'createRun': {
                const { workspaceId, message, autoApply, isDestroy = false, targetAddresses } = inputs;
                const attributes: any = {
                    message: message ?? 'Run triggered by SabFlow',
                    'is-destroy': isDestroy,
                };
                if (autoApply !== undefined) attributes['auto-apply'] = autoApply;
                if (targetAddresses) attributes['target-addrs'] = targetAddresses;
                const res = await fetch(`${baseUrl}/runs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: {
                            type: 'runs',
                            attributes,
                            relationships: { workspace: { data: { type: 'workspaces', id: workspaceId } } },
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { run: data.data } };
            }

            case 'getRun': {
                const { runId } = inputs;
                const res = await fetch(`${baseUrl}/runs/${runId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { run: data.data } };
            }

            case 'listRuns': {
                const { workspaceId, pageSize = 20, pageNumber = 1 } = inputs;
                const res = await fetch(`${baseUrl}/workspaces/${workspaceId}/runs?page[size]=${pageSize}&page[number]=${pageNumber}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { runs: data.data, meta: data.meta } };
            }

            case 'applyRun': {
                const { runId, comment } = inputs;
                const res = await fetch(`${baseUrl}/runs/${runId}/actions/apply`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ comment: comment ?? '' }),
                });
                if (res.status === 202) return { output: { applied: true, runId } };
                const data = await res.json();
                return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
            }

            case 'discardRun': {
                const { runId, comment } = inputs;
                const res = await fetch(`${baseUrl}/runs/${runId}/actions/discard`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ comment: comment ?? '' }),
                });
                if (res.status === 202) return { output: { discarded: true, runId } };
                const data = await res.json();
                return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
            }

            case 'cancelRun': {
                const { runId, comment } = inputs;
                const res = await fetch(`${baseUrl}/runs/${runId}/actions/cancel`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ comment: comment ?? '' }),
                });
                if (res.status === 202) return { output: { cancelled: true, runId } };
                const data = await res.json();
                return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
            }

            case 'listStateVersions': {
                const { workspaceId, pageSize = 20, pageNumber = 1 } = inputs;
                const res = await fetch(`${baseUrl}/workspaces/${workspaceId}/state-versions?page[size]=${pageSize}&page[number]=${pageNumber}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { stateVersions: data.data, meta: data.meta } };
            }

            case 'getCurrentStateVersion': {
                const { workspaceId } = inputs;
                const res = await fetch(`${baseUrl}/workspaces/${workspaceId}/current-state-version`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `HTTP ${res.status}` };
                return { output: { stateVersion: data.data } };
            }

            default:
                return { error: `Unknown Terraform Cloud action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`TerraformCloud action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in TerraformCloud action' };
    }
}
