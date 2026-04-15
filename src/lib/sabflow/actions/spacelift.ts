'use server';

export async function executeSpaceLiftAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const endpoint = `https://${inputs.subdomain}.app.spacelift.io/graphql`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.token}`,
            'Content-Type': 'application/json',
        };

        async function gql(query: string, variables: Record<string, any> = {}) {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables }),
            });
            return res.json();
        }

        switch (actionName) {
            case 'listStacks': {
                const data = await gql(`
                    query ListStacks($first: Int, $after: String) {
                        stacks(first: $first, after: $after) {
                            edges { node { id name space state description } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `, { first: inputs.first ?? 50, after: inputs.after ?? null });
                return { output: data };
            }

            case 'getStack': {
                const data = await gql(`
                    query GetStack($id: ID!) {
                        stack(id: $id) { id name space state description branch projectRoot repository }
                    }
                `, { id: inputs.stackId });
                return { output: data };
            }

            case 'createStack': {
                const data = await gql(`
                    mutation CreateStack($input: StackInput!) {
                        stackCreate(input: $input) { id name state }
                    }
                `, {
                    input: {
                        name: inputs.name,
                        repository: inputs.repository,
                        branch: inputs.branch ?? 'main',
                        space: inputs.space,
                        projectRoot: inputs.projectRoot,
                        description: inputs.description,
                        labels: inputs.labels ?? [],
                    },
                });
                return { output: data };
            }

            case 'updateStack': {
                const data = await gql(`
                    mutation UpdateStack($id: ID!, $input: StackInput!) {
                        stackUpdate(id: $id, input: $input) { id name state }
                    }
                `, {
                    id: inputs.stackId,
                    input: {
                        name: inputs.name,
                        branch: inputs.branch,
                        projectRoot: inputs.projectRoot,
                        description: inputs.description,
                        labels: inputs.labels,
                    },
                });
                return { output: data };
            }

            case 'deleteStack': {
                const data = await gql(`
                    mutation DeleteStack($id: ID!) {
                        stackDelete(id: $id) { id }
                    }
                `, { id: inputs.stackId });
                return { output: data };
            }

            case 'triggerRun': {
                const data = await gql(`
                    mutation TriggerRun($stackId: ID!, $commitSha: String) {
                        runTrigger(stackId: $stackId, commitSha: $commitSha) { id state type }
                    }
                `, { stackId: inputs.stackId, commitSha: inputs.commitSha ?? null });
                return { output: data };
            }

            case 'getRun': {
                const data = await gql(`
                    query GetRun($id: ID!) {
                        run(id: $id) { id state type createdAt finishedAt }
                    }
                `, { id: inputs.runId });
                return { output: data };
            }

            case 'listRuns': {
                const data = await gql(`
                    query ListRuns($stackId: ID!, $first: Int, $after: String) {
                        stack(id: $stackId) {
                            runs(first: $first, after: $after) {
                                edges { node { id state type createdAt } }
                                pageInfo { hasNextPage endCursor }
                            }
                        }
                    }
                `, { stackId: inputs.stackId, first: inputs.first ?? 20, after: inputs.after ?? null });
                return { output: data };
            }

            case 'confirmRun': {
                const data = await gql(`
                    mutation ConfirmRun($id: ID!) {
                        runConfirm(id: $id) { id state }
                    }
                `, { id: inputs.runId });
                return { output: data };
            }

            case 'cancelRun': {
                const data = await gql(`
                    mutation CancelRun($id: ID!) {
                        runCancel(id: $id) { id state }
                    }
                `, { id: inputs.runId });
                return { output: data };
            }

            case 'discardRun': {
                const data = await gql(`
                    mutation DiscardRun($id: ID!, $note: String) {
                        runDiscard(id: $id, note: $note) { id state }
                    }
                `, { id: inputs.runId, note: inputs.note ?? null });
                return { output: data };
            }

            case 'listPolicies': {
                const data = await gql(`
                    query ListPolicies($first: Int) {
                        policies(first: $first) {
                            edges { node { id name type space } }
                        }
                    }
                `, { first: inputs.first ?? 50 });
                return { output: data };
            }

            case 'createPolicy': {
                const data = await gql(`
                    mutation CreatePolicy($input: PolicyInput!) {
                        policyCreate(input: $input) { id name type }
                    }
                `, {
                    input: {
                        name: inputs.name,
                        type: inputs.type,
                        body: inputs.body,
                        space: inputs.space,
                        labels: inputs.labels ?? [],
                    },
                });
                return { output: data };
            }

            case 'listContexts': {
                const data = await gql(`
                    query ListContexts($first: Int) {
                        contexts(first: $first) {
                            edges { node { id name space description } }
                        }
                    }
                `, { first: inputs.first ?? 50 });
                return { output: data };
            }

            case 'createContext': {
                const data = await gql(`
                    mutation CreateContext($input: ContextInput!) {
                        contextCreate(input: $input) { id name space }
                    }
                `, {
                    input: {
                        name: inputs.name,
                        space: inputs.space,
                        description: inputs.description,
                        labels: inputs.labels ?? [],
                    },
                });
                return { output: data };
            }

            default:
                return { error: `Unknown Spacelift action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Spacelift action error: ${err.message}`);
        return { error: err.message };
    }
}
