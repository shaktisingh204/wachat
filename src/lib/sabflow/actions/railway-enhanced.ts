'use server';

const GRAPHQL_ENDPOINT = 'https://backboard.railway.app/graphql/v2';

async function railwayQuery(token: string, query: string, variables: Record<string, any> = {}): Promise<any> {
    const res = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });
    return res.json();
}

export async function executeRailwayEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = inputs.token;
        if (!token) return { error: 'Missing token in inputs' };

        switch (actionName) {
            case 'listProjects': {
                const query = `
                    query {
                        projects {
                            edges {
                                node {
                                    id
                                    name
                                    description
                                    createdAt
                                    updatedAt
                                }
                            }
                        }
                    }
                `;
                const data = await railwayQuery(token, query);
                return { output: data };
            }
            case 'getProject': {
                if (!inputs.projectId) return { error: 'Missing projectId' };
                const query = `
                    query GetProject($id: String!) {
                        project(id: $id) {
                            id
                            name
                            description
                            createdAt
                            updatedAt
                            services {
                                edges {
                                    node { id name }
                                }
                            }
                        }
                    }
                `;
                const data = await railwayQuery(token, query, { id: inputs.projectId });
                return { output: data };
            }
            case 'createProject': {
                if (!inputs.name) return { error: 'Missing project name' };
                const query = `
                    mutation CreateProject($input: ProjectCreateInput!) {
                        projectCreate(input: $input) {
                            id
                            name
                            description
                        }
                    }
                `;
                const input: any = { name: inputs.name };
                if (inputs.description) input.description = inputs.description;
                const data = await railwayQuery(token, query, { input });
                return { output: data };
            }
            case 'deleteProject': {
                if (!inputs.projectId) return { error: 'Missing projectId' };
                const query = `
                    mutation DeleteProject($id: String!) {
                        projectDelete(id: $id)
                    }
                `;
                const data = await railwayQuery(token, query, { id: inputs.projectId });
                return { output: data };
            }
            case 'listServices': {
                if (!inputs.projectId) return { error: 'Missing projectId' };
                const query = `
                    query ListServices($projectId: String!) {
                        project(id: $projectId) {
                            services {
                                edges {
                                    node {
                                        id
                                        name
                                        createdAt
                                        updatedAt
                                    }
                                }
                            }
                        }
                    }
                `;
                const data = await railwayQuery(token, query, { projectId: inputs.projectId });
                return { output: data };
            }
            case 'getService': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const query = `
                    query GetService($id: String!) {
                        service(id: $id) {
                            id
                            name
                            createdAt
                            updatedAt
                        }
                    }
                `;
                const data = await railwayQuery(token, query, { id: inputs.serviceId });
                return { output: data };
            }
            case 'createService': {
                if (!inputs.projectId || !inputs.name) return { error: 'Missing projectId or name' };
                const query = `
                    mutation CreateService($input: ServiceCreateInput!) {
                        serviceCreate(input: $input) {
                            id
                            name
                        }
                    }
                `;
                const input: any = { projectId: inputs.projectId, name: inputs.name };
                if (inputs.source) input.source = inputs.source;
                const data = await railwayQuery(token, query, { input });
                return { output: data };
            }
            case 'deleteService': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const query = `
                    mutation DeleteService($id: String!) {
                        serviceDelete(id: $id)
                    }
                `;
                const data = await railwayQuery(token, query, { id: inputs.serviceId });
                return { output: data };
            }
            case 'listDeployments': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const query = `
                    query ListDeployments($serviceId: String!) {
                        deployments(input: { serviceId: $serviceId }) {
                            edges {
                                node {
                                    id
                                    status
                                    createdAt
                                    url
                                }
                            }
                        }
                    }
                `;
                const data = await railwayQuery(token, query, { serviceId: inputs.serviceId });
                return { output: data };
            }
            case 'getDeployment': {
                if (!inputs.deploymentId) return { error: 'Missing deploymentId' };
                const query = `
                    query GetDeployment($id: String!) {
                        deployment(id: $id) {
                            id
                            status
                            url
                            createdAt
                            updatedAt
                        }
                    }
                `;
                const data = await railwayQuery(token, query, { id: inputs.deploymentId });
                return { output: data };
            }
            case 'redeploy': {
                if (!inputs.deploymentId) return { error: 'Missing deploymentId' };
                const query = `
                    mutation Redeploy($id: String!) {
                        deploymentRedeploy(id: $id) {
                            id
                            status
                        }
                    }
                `;
                const data = await railwayQuery(token, query, { id: inputs.deploymentId });
                return { output: data };
            }
            case 'listVariables': {
                if (!inputs.projectId || !inputs.serviceId) return { error: 'Missing projectId or serviceId' };
                const query = `
                    query ListVariables($projectId: String!, $serviceId: String!, $environmentId: String!) {
                        variables(projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId)
                    }
                `;
                const data = await railwayQuery(token, query, {
                    projectId: inputs.projectId,
                    serviceId: inputs.serviceId,
                    environmentId: inputs.environmentId || '',
                });
                return { output: data };
            }
            case 'setVariable': {
                if (!inputs.projectId || !inputs.serviceId || !inputs.name || inputs.value === undefined) {
                    return { error: 'Missing projectId, serviceId, name, or value' };
                }
                const query = `
                    mutation UpsertVariables($input: VariableUpsertInput!) {
                        variableUpsert(input: $input)
                    }
                `;
                const input = {
                    projectId: inputs.projectId,
                    serviceId: inputs.serviceId,
                    environmentId: inputs.environmentId || '',
                    name: inputs.name,
                    value: String(inputs.value),
                };
                const data = await railwayQuery(token, query, { input });
                return { output: data };
            }
            case 'deleteVariable': {
                if (!inputs.projectId || !inputs.serviceId || !inputs.name) {
                    return { error: 'Missing projectId, serviceId, or name' };
                }
                const query = `
                    mutation DeleteVariable($input: VariableDeleteInput!) {
                        variableDelete(input: $input)
                    }
                `;
                const input = {
                    projectId: inputs.projectId,
                    serviceId: inputs.serviceId,
                    environmentId: inputs.environmentId || '',
                    name: inputs.name,
                };
                const data = await railwayQuery(token, query, { input });
                return { output: data };
            }
            case 'listDomains': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const query = `
                    query ListDomains($serviceId: String!, $projectId: String!, $environmentId: String!) {
                        domains(serviceId: $serviceId, projectId: $projectId, environmentId: $environmentId) {
                            serviceDomains {
                                edges { node { id domain } }
                            }
                            customDomains {
                                edges { node { id domain } }
                            }
                        }
                    }
                `;
                const data = await railwayQuery(token, query, {
                    serviceId: inputs.serviceId,
                    projectId: inputs.projectId || '',
                    environmentId: inputs.environmentId || '',
                });
                return { output: data };
            }
            default:
                return { error: `Unknown Railway Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeRailwayEnhancedAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in Railway Enhanced action' };
    }
}
