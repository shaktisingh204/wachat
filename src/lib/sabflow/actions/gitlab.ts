'use server';

export async function executeGitlabAction(
  action: string,
  inputs: Record<string, unknown>
): Promise<{ output?: Record<string, unknown>; error?: string }> {
  const token = inputs.token as string;
  if (!token) return { error: 'Missing token' };

  const baseUrl = (inputs.baseUrl as string) || 'https://gitlab.com';
  const base = `${baseUrl}/api/v4`;

  const headers: Record<string, string> = {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
  };

  async function gitlabFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<{ output?: Record<string, unknown>; error?: string }> {
    const url = `${base}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });
    if (res.status === 204) return { output: { success: true } };
    const text = await res.text();
    if (!res.ok) return { error: `GitLab API error ${res.status}: ${text}` };
    try {
      const json = JSON.parse(text);
      return { output: Array.isArray(json) ? { items: json } : json };
    } catch {
      return { output: { raw: text } };
    }
  }

  switch (action) {
    case 'listProjects': {
      const params = new URLSearchParams();
      if (inputs.owned !== false) params.set('owned', 'true');
      if (inputs.search) params.set('search', inputs.search as string);
      return gitlabFetch(`/projects?${params.toString()}`);
    }

    case 'getProject': {
      const projectId = inputs.projectId as string;
      if (!projectId) return { error: 'Missing projectId' };
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}`);
    }

    case 'createIssue': {
      const projectId = inputs.projectId as string;
      if (!projectId) return { error: 'Missing projectId' };
      const body: Record<string, unknown> = { title: inputs.title };
      if (inputs.description) body.description = inputs.description;
      if (inputs.labels) body.labels = inputs.labels;
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/issues`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    case 'getIssue': {
      const projectId = inputs.projectId as string;
      const issueIid = inputs.issueIid as string;
      if (!projectId || !issueIid) return { error: 'Missing projectId or issueIid' };
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`);
    }

    case 'updateIssue': {
      const projectId = inputs.projectId as string;
      const issueIid = inputs.issueIid as string;
      if (!projectId || !issueIid) return { error: 'Missing projectId or issueIid' };
      const body: Record<string, unknown> = {};
      if (inputs.title) body.title = inputs.title;
      if (inputs.description) body.description = inputs.description;
      if (inputs.stateEvent) body.state_event = inputs.stateEvent;
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    }

    case 'listIssues': {
      const projectId = inputs.projectId as string;
      if (!projectId) return { error: 'Missing projectId' };
      const params = new URLSearchParams();
      if (inputs.state) params.set('state', inputs.state as string);
      if (inputs.labels) params.set('labels', inputs.labels as string);
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/issues?${params.toString()}`);
    }

    case 'createMR': {
      const projectId = inputs.projectId as string;
      if (!projectId) return { error: 'Missing projectId' };
      const body: Record<string, unknown> = {
        source_branch: inputs.sourceBranch,
        target_branch: inputs.targetBranch,
        title: inputs.title,
      };
      if (inputs.description) body.description = inputs.description;
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/merge_requests`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    case 'listMRs': {
      const projectId = inputs.projectId as string;
      if (!projectId) return { error: 'Missing projectId' };
      const params = new URLSearchParams();
      if (inputs.state) params.set('state', inputs.state as string);
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/merge_requests?${params.toString()}`);
    }

    case 'createBranch': {
      const projectId = inputs.projectId as string;
      if (!projectId) return { error: 'Missing projectId' };
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/repository/branches`, {
        method: 'POST',
        body: JSON.stringify({ branch: inputs.branchName, ref: inputs.ref }),
      });
    }

    case 'listBranches': {
      const projectId = inputs.projectId as string;
      if (!projectId) return { error: 'Missing projectId' };
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/repository/branches`);
    }

    case 'addIssueNote': {
      const projectId = inputs.projectId as string;
      const issueIid = inputs.issueIid as string;
      if (!projectId || !issueIid) return { error: 'Missing projectId or issueIid' };
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/issues/${issueIid}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: inputs.body }),
      });
    }

    case 'triggerPipeline': {
      const projectId = inputs.projectId as string;
      if (!projectId) return { error: 'Missing projectId' };
      const body: Record<string, unknown> = { ref: inputs.ref };
      if (inputs.variables) {
        let vars: Record<string, string>[];
        if (typeof inputs.variables === 'string') {
          try {
            vars = JSON.parse(inputs.variables);
          } catch {
            vars = [];
          }
        } else if (Array.isArray(inputs.variables)) {
          vars = inputs.variables as Record<string, string>[];
        } else {
          vars = [];
        }
        body.variables = vars;
      }
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/pipeline`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    case 'listPipelines': {
      const projectId = inputs.projectId as string;
      if (!projectId) return { error: 'Missing projectId' };
      const params = new URLSearchParams();
      if (inputs.ref) params.set('ref', inputs.ref as string);
      return gitlabFetch(`/projects/${encodeURIComponent(projectId)}/pipelines?${params.toString()}`);
    }

    default:
      return { error: `Unknown action: ${action}` };
  }
}
