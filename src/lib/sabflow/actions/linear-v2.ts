
'use server';

const LINEAR_API = 'https://api.linear.app/graphql';

async function linearQuery(apiKey: string, query: string, variables: Record<string, any> = {}, logger?: any) {
    logger?.log(`[Linear v2] GraphQL query`);
    const res = await fetch(LINEAR_API, {
        method: 'POST',
        headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (data.errors?.length) {
        throw new Error(data.errors[0]?.message || 'Linear GraphQL error');
    }
    if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
    return data.data;
}

export async function executeLinearV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const lq = (query: string, variables?: Record<string, any>) => linearQuery(apiKey, query, variables, logger);

        switch (actionName) {
            case 'createIssue': {
                const teamId = String(inputs.teamId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                if (!title) throw new Error('title is required.');
                const variables: any = { teamId, title };
                if (inputs.description) variables.description = String(inputs.description);
                if (inputs.priority) variables.priority = Number(inputs.priority);
                if (inputs.assigneeId) variables.assigneeId = String(inputs.assigneeId);
                if (inputs.stateId) variables.stateId = String(inputs.stateId);
                if (inputs.labelIds) variables.labelIds = typeof inputs.labelIds === 'string' ? JSON.parse(inputs.labelIds) : inputs.labelIds;
                if (inputs.dueDate) variables.dueDate = String(inputs.dueDate);
                const data = await lq(`
                    mutation CreateIssue($teamId: String!, $title: String!, $description: String, $priority: Int, $assigneeId: String, $stateId: String, $labelIds: [String!], $dueDate: TimelessDate) {
                        issueCreate(input: { teamId: $teamId, title: $title, description: $description, priority: $priority, assigneeId: $assigneeId, stateId: $stateId, labelIds: $labelIds, dueDate: $dueDate }) {
                            success
                            issue { id identifier title url priority state { name } }
                        }
                    }
                `, variables);
                const issue = data.issueCreate?.issue ?? {};
                return { output: { id: issue.id ?? '', identifier: issue.identifier ?? '', title: issue.title ?? '', url: issue.url ?? '', success: String(data.issueCreate?.success ?? false) } };
            }

            case 'updateIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                const updateInput: any = {};
                if (inputs.title) updateInput.title = String(inputs.title);
                if (inputs.description) updateInput.description = String(inputs.description);
                if (inputs.priority !== undefined) updateInput.priority = Number(inputs.priority);
                if (inputs.stateId) updateInput.stateId = String(inputs.stateId);
                if (inputs.assigneeId) updateInput.assigneeId = String(inputs.assigneeId);
                if (inputs.dueDate) updateInput.dueDate = String(inputs.dueDate);
                const data = await lq(`
                    mutation UpdateIssue($issueId: String!, $input: IssueUpdateInput!) {
                        issueUpdate(id: $issueId, input: $input) {
                            success
                            issue { id identifier title url }
                        }
                    }
                `, { issueId, input: updateInput });
                const issue = data.issueUpdate?.issue ?? {};
                return { output: { id: issue.id ?? issueId, identifier: issue.identifier ?? '', title: issue.title ?? '', url: issue.url ?? '', success: String(data.issueUpdate?.success ?? false) } };
            }

            case 'listIssues': {
                const variables: any = {};
                const filters: any = {};
                if (inputs.teamId) filters.team = { id: { eq: String(inputs.teamId) } };
                if (inputs.assigneeId) filters.assignee = { id: { eq: String(inputs.assigneeId) } };
                if (inputs.stateId) filters.state = { id: { eq: String(inputs.stateId) } };
                if (Object.keys(filters).length > 0) variables.filter = filters;
                if (inputs.first) variables.first = Number(inputs.first);
                const data = await lq(`
                    query ListIssues($filter: IssueFilter, $first: Int) {
                        issues(filter: $filter, first: $first) {
                            nodes { id identifier title url priority createdAt state { name } assignee { name } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `, variables);
                const nodes = data.issues?.nodes ?? [];
                return { output: { count: String(nodes.length), hasNextPage: String(data.issues?.pageInfo?.hasNextPage ?? false), issues: JSON.stringify(nodes) } };
            }

            case 'createComment': {
                const issueId = String(inputs.issueId ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                if (!body) throw new Error('body is required.');
                const data = await lq(`
                    mutation CreateComment($issueId: String!, $body: String!) {
                        commentCreate(input: { issueId: $issueId, body: $body }) {
                            success
                            comment { id body createdAt }
                        }
                    }
                `, { issueId, body });
                const comment = data.commentCreate?.comment ?? {};
                return { output: { id: comment.id ?? '', body: comment.body ?? body, success: String(data.commentCreate?.success ?? false) } };
            }

            case 'listProjects': {
                const variables: any = {};
                if (inputs.teamId) variables.teamId = String(inputs.teamId);
                if (inputs.first) variables.first = Number(inputs.first);
                const data = await lq(`
                    query ListProjects($first: Int) {
                        projects(first: $first) {
                            nodes { id name description url state startDate targetDate }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `, variables);
                const nodes = data.projects?.nodes ?? [];
                return { output: { count: String(nodes.length), projects: JSON.stringify(nodes) } };
            }

            case 'createProject': {
                const teamIds = inputs.teamIds
                    ? (typeof inputs.teamIds === 'string' ? JSON.parse(inputs.teamIds) : inputs.teamIds)
                    : (inputs.teamId ? [String(inputs.teamId)] : []);
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!teamIds.length) throw new Error('teamIds is required.');
                const variables: any = { name, teamIds };
                if (inputs.description) variables.description = String(inputs.description);
                if (inputs.state) variables.state = String(inputs.state);
                if (inputs.startDate) variables.startDate = String(inputs.startDate);
                if (inputs.targetDate) variables.targetDate = String(inputs.targetDate);
                const data = await lq(`
                    mutation CreateProject($name: String!, $teamIds: [String!]!, $description: String, $state: String, $startDate: TimelessDate, $targetDate: TimelessDate) {
                        projectCreate(input: { name: $name, teamIds: $teamIds, description: $description, state: $state, startDate: $startDate, targetDate: $targetDate }) {
                            success
                            project { id name url }
                        }
                    }
                `, variables);
                const project = data.projectCreate?.project ?? {};
                return { output: { id: project.id ?? '', name: project.name ?? name, url: project.url ?? '', success: String(data.projectCreate?.success ?? false) } };
            }

            case 'getTeams': {
                const data = await lq(`
                    query GetTeams {
                        teams { nodes { id name key description } }
                    }
                `);
                const teams = data.teams?.nodes ?? [];
                return { output: { count: String(teams.length), teams: JSON.stringify(teams) } };
            }

            case 'getWorkflowStates': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await lq(`
                    query GetWorkflowStates($teamId: String!) {
                        workflowStates(filter: { team: { id: { eq: $teamId } } }) {
                            nodes { id name type color }
                        }
                    }
                `, { teamId });
                const states = data.workflowStates?.nodes ?? [];
                return { output: { count: String(states.length), states: JSON.stringify(states) } };
            }

            default:
                return { error: `Linear v2 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Linear v2 action failed.' };
    }
}
