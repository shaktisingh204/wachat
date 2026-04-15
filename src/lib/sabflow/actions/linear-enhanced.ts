'use server';

export async function executeLinearEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const endpoint = 'https://api.linear.app/graphql';
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': inputs.apiKey,
    };

    try {
        switch (actionName) {
            case 'listIssues': {
                const query = `query($first: Int, $filter: IssueFilter) { issues(first: $first, filter: $filter) { nodes { id title description state { name } assignee { name } priority createdAt updatedAt } } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { first: inputs.first ?? 50, filter: inputs.filter ?? undefined } }) });
                const data = await res.json();
                return { output: { issues: data.data?.issues?.nodes ?? [], errors: data.errors } };
            }
            case 'getIssue': {
                const query = `query($id: String!) { issue(id: $id) { id title description state { name } assignee { name } priority team { name } createdAt updatedAt } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { id: inputs.issueId } }) });
                const data = await res.json();
                return { output: { issue: data.data?.issue, errors: data.errors } };
            }
            case 'createIssue': {
                const mutation = `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title } } }`;
                const input: any = { title: inputs.title, teamId: inputs.teamId };
                if (inputs.description) input.description = inputs.description;
                if (inputs.priority !== undefined) input.priority = inputs.priority;
                if (inputs.assigneeId) input.assigneeId = inputs.assigneeId;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: mutation, variables: { input } }) });
                const data = await res.json();
                return { output: { result: data.data?.issueCreate, errors: data.errors } };
            }
            case 'updateIssue': {
                const mutation = `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id title } } }`;
                const input: any = {};
                if (inputs.title) input.title = inputs.title;
                if (inputs.description) input.description = inputs.description;
                if (inputs.priority !== undefined) input.priority = inputs.priority;
                if (inputs.stateId) input.stateId = inputs.stateId;
                if (inputs.assigneeId) input.assigneeId = inputs.assigneeId;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: mutation, variables: { id: inputs.issueId, input } }) });
                const data = await res.json();
                return { output: { result: data.data?.issueUpdate, errors: data.errors } };
            }
            case 'deleteIssue': {
                const mutation = `mutation($id: String!) { issueDelete(id: $id) { success } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: mutation, variables: { id: inputs.issueId } }) });
                const data = await res.json();
                return { output: { result: data.data?.issueDelete, errors: data.errors } };
            }
            case 'listProjects': {
                const query = `query($first: Int) { projects(first: $first) { nodes { id name description state createdAt updatedAt } } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { first: inputs.first ?? 50 } }) });
                const data = await res.json();
                return { output: { projects: data.data?.projects?.nodes ?? [], errors: data.errors } };
            }
            case 'getProject': {
                const query = `query($id: String!) { project(id: $id) { id name description state createdAt updatedAt } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { id: inputs.projectId } }) });
                const data = await res.json();
                return { output: { project: data.data?.project, errors: data.errors } };
            }
            case 'createProject': {
                const mutation = `mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { success project { id name } } }`;
                const input: any = { name: inputs.name, teamIds: inputs.teamIds };
                if (inputs.description) input.description = inputs.description;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: mutation, variables: { input } }) });
                const data = await res.json();
                return { output: { result: data.data?.projectCreate, errors: data.errors } };
            }
            case 'listTeams': {
                const query = `query($first: Int) { teams(first: $first) { nodes { id name key description } } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { first: inputs.first ?? 50 } }) });
                const data = await res.json();
                return { output: { teams: data.data?.teams?.nodes ?? [], errors: data.errors } };
            }
            case 'getTeam': {
                const query = `query($id: String!) { team(id: $id) { id name key description } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { id: inputs.teamId } }) });
                const data = await res.json();
                return { output: { team: data.data?.team, errors: data.errors } };
            }
            case 'listUsers': {
                const query = `query($first: Int) { users(first: $first) { nodes { id name email displayName } } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { first: inputs.first ?? 50 } }) });
                const data = await res.json();
                return { output: { users: data.data?.users?.nodes ?? [], errors: data.errors } };
            }
            case 'getUser': {
                const query = `query($id: String!) { user(id: $id) { id name email displayName } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { id: inputs.userId } }) });
                const data = await res.json();
                return { output: { user: data.data?.user, errors: data.errors } };
            }
            case 'listCycles': {
                const query = `query($teamId: String!, $first: Int) { team(id: $teamId) { cycles(first: $first) { nodes { id name number startsAt endsAt } } } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { teamId: inputs.teamId, first: inputs.first ?? 20 } }) });
                const data = await res.json();
                return { output: { cycles: data.data?.team?.cycles?.nodes ?? [], errors: data.errors } };
            }
            case 'createComment': {
                const mutation = `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id body } } }`;
                const input: any = { issueId: inputs.issueId, body: inputs.body };
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: mutation, variables: { input } }) });
                const data = await res.json();
                return { output: { result: data.data?.commentCreate, errors: data.errors } };
            }
            case 'searchIssues': {
                const query = `query($term: String!, $first: Int) { issueSearch(term: $term, first: $first) { nodes { id title description state { name } assignee { name } } } }`;
                const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables: { term: inputs.term, first: inputs.first ?? 25 } }) });
                const data = await res.json();
                return { output: { issues: data.data?.issueSearch?.nodes ?? [], errors: data.errors } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`LinearEnhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
