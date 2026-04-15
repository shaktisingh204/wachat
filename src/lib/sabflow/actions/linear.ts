
'use server';

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

async function linearQuery(apiKey: string, query: string, variables?: Record<string, any>, logger?: any): Promise<any> {
    logger?.log(`[Linear] GraphQL request`);
    const res = await fetch(LINEAR_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: variables ?? {} }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.message || `Linear API error: ${res.status}`);
    }
    if (data.errors?.length) {
        throw new Error(data.errors[0].message || 'Linear GraphQL error.');
    }
    return data.data;
}

export async function executeLinearAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const gql = (query: string, variables?: Record<string, any>) =>
            linearQuery(apiKey, query, variables, logger);

        switch (actionName) {
            case 'createIssue': {
                const teamId = String(inputs.teamId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                if (!title) throw new Error('title is required.');

                const input: any = { teamId, title };
                if (inputs.description) input.description = String(inputs.description);
                if (inputs.priority !== undefined && inputs.priority !== '') input.priority = Number(inputs.priority);
                if (inputs.assigneeId) input.assigneeId = String(inputs.assigneeId);

                const data = await gql(
                    `mutation CreateIssue($input: IssueCreateInput!) {
                        issueCreate(input: $input) {
                            success
                            issue { id identifier title url }
                        }
                    }`,
                    { input }
                );
                const issue = data.issueCreate?.issue;
                if (!data.issueCreate?.success || !issue) throw new Error('Failed to create issue.');
                logger.log(`[Linear] Issue created: ${issue.identifier}`);
                return { output: { id: issue.id, identifier: issue.identifier, title: issue.title, url: issue.url } };
            }

            case 'getIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');

                const data = await gql(
                    `query GetIssue($id: String!) {
                        issue(id: $id) {
                            id identifier title description
                            state { name }
                            priority
                        }
                    }`,
                    { id: issueId }
                );
                const issue = data.issue;
                if (!issue) throw new Error('Issue not found.');
                return {
                    output: {
                        id: issue.id,
                        identifier: issue.identifier,
                        title: issue.title,
                        description: issue.description ?? '',
                        state: issue.state?.name ?? '',
                        priority: issue.priority,
                    },
                };
            }

            case 'updateIssue': {
                const issueId = String(inputs.issueId ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');

                const input: any = {};
                if (inputs.title) input.title = String(inputs.title);
                if (inputs.description !== undefined) input.description = String(inputs.description);
                if (inputs.priority !== undefined && inputs.priority !== '') input.priority = Number(inputs.priority);
                if (inputs.stateId) input.stateId = String(inputs.stateId);
                if (inputs.assigneeId) input.assigneeId = String(inputs.assigneeId);

                const data = await gql(
                    `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
                        issueUpdate(id: $id, input: $input) {
                            success
                            issue { id identifier }
                        }
                    }`,
                    { id: issueId, input }
                );
                if (!data.issueUpdate?.success) throw new Error('Failed to update issue.');
                return { output: { id: data.issueUpdate.issue?.id ?? issueId } };
            }

            case 'listIssues': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const first = Number(inputs.first ?? 50);

                const data = await gql(
                    `query ListIssues($teamId: String!, $first: Int) {
                        team(id: $teamId) {
                            issues(first: $first) {
                                nodes { id identifier title state { name } priority url }
                            }
                        }
                    }`,
                    { teamId, first }
                );
                const issues = data.team?.issues?.nodes ?? [];
                return { output: { issues, count: issues.length } };
            }

            case 'createProject': {
                const teamId = String(inputs.teamId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                if (!name) throw new Error('name is required.');

                const input: any = { teamIds: [teamId], name };
                if (inputs.description) input.description = String(inputs.description);

                const data = await gql(
                    `mutation CreateProject($input: ProjectCreateInput!) {
                        projectCreate(input: $input) {
                            success
                            project { id name }
                        }
                    }`,
                    { input }
                );
                const project = data.projectCreate?.project;
                if (!data.projectCreate?.success || !project) throw new Error('Failed to create project.');
                return { output: { id: project.id, name: project.name } };
            }

            case 'listProjects': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');

                const data = await gql(
                    `query ListProjects($teamId: String!) {
                        team(id: $teamId) {
                            projects { nodes { id name description } }
                        }
                    }`,
                    { teamId }
                );
                const projects = data.team?.projects?.nodes ?? [];
                return { output: { projects, count: projects.length } };
            }

            case 'createComment': {
                const issueId = String(inputs.issueId ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!issueId) throw new Error('issueId is required.');
                if (!body) throw new Error('body is required.');

                const data = await gql(
                    `mutation CreateComment($input: CommentCreateInput!) {
                        commentCreate(input: $input) {
                            success
                            comment { id }
                        }
                    }`,
                    { input: { issueId, body } }
                );
                if (!data.commentCreate?.success) throw new Error('Failed to create comment.');
                return { output: { id: data.commentCreate.comment?.id ?? '' } };
            }

            case 'listTeams': {
                const data = await gql(
                    `query ListTeams {
                        teams { nodes { id name key } }
                    }`
                );
                const teams = data.teams?.nodes ?? [];
                return { output: { teams, count: teams.length } };
            }

            case 'listUsers': {
                const data = await gql(
                    `query ListUsers {
                        users { nodes { id name email displayName } }
                    }`
                );
                const users = data.users?.nodes ?? [];
                return { output: { users, count: users.length } };
            }

            case 'searchIssues': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const teamId = inputs.teamId ? String(inputs.teamId).trim() : undefined;

                const data = await gql(
                    `query SearchIssues($term: String!, $teamId: String) {
                        issueSearch(term: $term, filter: { team: { id: { eq: $teamId } } }) {
                            nodes { id identifier title state { name } priority url }
                        }
                    }`,
                    { term: query, teamId: teamId ?? null }
                );
                const issues = data.issueSearch?.nodes ?? [];
                return { output: { issues, count: issues.length } };
            }

            case 'createLabel': {
                const teamId = String(inputs.teamId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const color = String(inputs.color ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                if (!name) throw new Error('name is required.');
                if (!color) throw new Error('color is required.');

                const data = await gql(
                    `mutation CreateLabel($input: IssueLabelCreateInput!) {
                        issueLabelCreate(input: $input) {
                            success
                            issueLabel { id name color }
                        }
                    }`,
                    { input: { teamId, name, color } }
                );
                if (!data.issueLabelCreate?.success) throw new Error('Failed to create label.');
                return { output: { id: data.issueLabelCreate.issueLabel?.id ?? '' } };
            }

            case 'listLabels': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');

                const data = await gql(
                    `query ListLabels($teamId: String!) {
                        team(id: $teamId) {
                            labels { nodes { id name color } }
                        }
                    }`,
                    { teamId }
                );
                const labels = data.team?.labels?.nodes ?? [];
                return { output: { labels, count: labels.length } };
            }

            case 'getWorkflowStates': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');

                const data = await gql(
                    `query GetWorkflowStates($teamId: String!) {
                        team(id: $teamId) {
                            states { nodes { id name type color position } }
                        }
                    }`,
                    { teamId }
                );
                const states = data.team?.states?.nodes ?? [];
                return { output: { states, count: states.length } };
            }

            default:
                return { error: `Linear action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Linear action failed.' };
    }
}
