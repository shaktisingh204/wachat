'use server';

const RAILWAY_GRAPHQL_URL = 'https://backboard.railway.app/graphql/v2';

async function railwayQuery(apiToken: string, query: string, variables: any = {}) {
    const res = await fetch(RAILWAY_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (data.errors?.length) {
        throw new Error(data.errors[0].message);
    }
    return data.data;
}

export async function executeRailwayAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        switch (actionName) {
            case 'listProjects': {
                const data = await railwayQuery(inputs.apiToken, `
                    query { projects { edges { node { id name description createdAt updatedAt } } } }
                `);
                return { output: { projects: data.projects.edges.map((e: any) => e.node) } };
            }

            case 'getProject': {
                const data = await railwayQuery(inputs.apiToken, `
                    query($id: String!) { project(id: $id) { id name description createdAt updatedAt } }
                `, { id: inputs.projectId });
                return { output: { project: data.project } };
            }

            case 'createProject': {
                const data = await railwayQuery(inputs.apiToken, `
                    mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { id name description createdAt } }
                `, { input: { name: inputs.name, description: inputs.description || '' } });
                return { output: { project: data.projectCreate } };
            }

            case 'deleteProject': {
                const data = await railwayQuery(inputs.apiToken, `
                    mutation($id: String!) { projectDelete(id: $id) }
                `, { id: inputs.projectId });
                return { output: { deleted: data.projectDelete } };
            }

            case 'listServices': {
                const data = await railwayQuery(inputs.apiToken, `
                    query($projectId: String!) {
                        project(id: $projectId) {
                            services { edges { node { id name createdAt updatedAt } } }
                        }
                    }
                `, { projectId: inputs.projectId });
                return { output: { services: data.project.services.edges.map((e: any) => e.node) } };
            }

            case 'getService': {
                const data = await railwayQuery(inputs.apiToken, `
                    query($id: String!) { service(id: $id) { id name createdAt updatedAt } }
                `, { id: inputs.serviceId });
                return { output: { service: data.service } };
            }

            case 'createService': {
                const data = await railwayQuery(inputs.apiToken, `
                    mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name createdAt } }
                `, { input: { projectId: inputs.projectId, name: inputs.name } });
                return { output: { service: data.serviceCreate } };
            }

            case 'deleteService': {
                const data = await railwayQuery(inputs.apiToken, `
                    mutation($id: String!, $environmentId: String!) { serviceDelete(id: $id, environmentId: $environmentId) }
                `, { id: inputs.serviceId, environmentId: inputs.environmentId });
                return { output: { deleted: data.serviceDelete } };
            }

            case 'listEnvironments': {
                const data = await railwayQuery(inputs.apiToken, `
                    query($projectId: String!) {
                        project(id: $projectId) {
                            environments { edges { node { id name createdAt updatedAt } } }
                        }
                    }
                `, { projectId: inputs.projectId });
                return { output: { environments: data.project.environments.edges.map((e: any) => e.node) } };
            }

            case 'getEnvironment': {
                const data = await railwayQuery(inputs.apiToken, `
                    query($id: String!) { environment(id: $id) { id name createdAt updatedAt } }
                `, { id: inputs.environmentId });
                return { output: { environment: data.environment } };
            }

            case 'createEnvironment': {
                const data = await railwayQuery(inputs.apiToken, `
                    mutation($input: EnvironmentCreateInput!) { environmentCreate(input: $input) { id name createdAt } }
                `, { input: { projectId: inputs.projectId, name: inputs.name } });
                return { output: { environment: data.environmentCreate } };
            }

            case 'listDeployments': {
                const data = await railwayQuery(inputs.apiToken, `
                    query($serviceId: String!, $environmentId: String!) {
                        deployments(input: { serviceId: $serviceId, environmentId: $environmentId }) {
                            edges { node { id status createdAt updatedAt } }
                        }
                    }
                `, { serviceId: inputs.serviceId, environmentId: inputs.environmentId });
                return { output: { deployments: data.deployments.edges.map((e: any) => e.node) } };
            }

            case 'getDeployment': {
                const data = await railwayQuery(inputs.apiToken, `
                    query($id: String!) { deployment(id: $id) { id status createdAt updatedAt } }
                `, { id: inputs.deploymentId });
                return { output: { deployment: data.deployment } };
            }

            case 'createDeployment': {
                const data = await railwayQuery(inputs.apiToken, `
                    mutation($input: DeploymentTriggerInput!) { deploymentTrigger(input: $input) { id status createdAt } }
                `, { input: { serviceId: inputs.serviceId, environmentId: inputs.environmentId } });
                return { output: { deployment: data.deploymentTrigger } };
            }

            case 'restartDeployment': {
                const data = await railwayQuery(inputs.apiToken, `
                    mutation($id: String!) { deploymentRestart(id: $id) }
                `, { id: inputs.deploymentId });
                return { output: { restarted: data.deploymentRestart } };
            }

            default:
                return { error: `Unknown Railway action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Railway action error: ${err.message}`);
        return { error: err.message || 'Railway action failed' };
    }
}
