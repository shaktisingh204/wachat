/**
 * Forge block: CircleCI
 *
 * Source: n8n-master/packages/nodes-base/nodes/CircleCi/CircleCi.node.ts
 * Credential type: 'circleci' (expects { apiToken }).
 *
 * Operations covered (CircleCI v2 API at https://circleci.com/api/v2/):
 *   - pipeline.trigger     POST /project/{project_slug}/pipeline
 *   - pipeline.get         GET  /pipeline/{pipelineId}
 *   - workflow.cancel      POST /workflow/{workflowId}/cancel
 *   - project.list         GET  /me/collaborations  (workspaces visible to the token)
 *
 * Deferred:
 *   - re-run job, artifacts, test-results
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://circleci.com/api/v2';

function token(ctx: ForgeActionContext): string {
  const cred = requireCredential('CircleCI', ctx.credential);
  const t = cred.apiToken;
  if (!t) throw new Error('CircleCI: credential is missing `apiToken`');
  return t;
}

async function pipelineTrigger(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectSlug = asString(ctx.options.projectSlug);
  if (!projectSlug) throw new Error('CircleCI: projectSlug is required (e.g. gh/org/repo)');

  const payload: Record<string, unknown> = {};
  const branch = asString(ctx.options.branch);
  const tag = asString(ctx.options.tag);
  const parametersRaw = asString(ctx.options.parameters);
  if (branch) payload.branch = branch;
  if (tag) payload.tag = tag;
  if (parametersRaw) {
    try {
      payload.parameters = JSON.parse(parametersRaw);
    } catch {
      throw new Error('CircleCI: parameters must be valid JSON');
    }
  }

  const res = await apiRequest({
    service: 'CircleCI',
    method: 'POST',
    url: `${API}/project/${projectSlug}/pipeline`,
    headers: { 'Circle-Token': token(ctx) },
    json: payload,
  });

  return {
    outputs: { pipeline: res.data },
    logs: [`CircleCI pipeline trigger → ${projectSlug}`],
  };
}

async function pipelineGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pipelineId = asString(ctx.options.pipelineId);
  if (!pipelineId) throw new Error('CircleCI: pipelineId is required');

  const res = await apiRequest({
    service: 'CircleCI',
    method: 'GET',
    url: `${API}/pipeline/${encodeURIComponent(pipelineId)}`,
    headers: { 'Circle-Token': token(ctx) },
  });

  return {
    outputs: { pipeline: res.data },
    logs: [`CircleCI pipeline get → ${pipelineId}`],
  };
}

async function workflowCancel(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workflowId = asString(ctx.options.workflowId);
  if (!workflowId) throw new Error('CircleCI: workflowId is required');

  const res = await apiRequest({
    service: 'CircleCI',
    method: 'POST',
    url: `${API}/workflow/${encodeURIComponent(workflowId)}/cancel`,
    headers: { 'Circle-Token': token(ctx) },
  });

  return {
    outputs: { result: res.data },
    logs: [`CircleCI workflow cancel → ${workflowId}`],
  };
}

async function projectList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'CircleCI',
    method: 'GET',
    url: `${API}/me/collaborations`,
    headers: { 'Circle-Token': token(ctx) },
  });
  const items = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { collaborations: items, count: items.length },
    logs: [`CircleCI list collaborations (${items.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_circleci',
  name: 'CircleCI',
  description: 'Trigger pipelines and cancel workflows on CircleCI.',
  iconName: 'LuCircleDot',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'circleci' },
  actions: [
    {
      id: 'pipeline_trigger',
      label: 'Trigger pipeline',
      description: 'Create a new pipeline run for a project.',
      fields: [
        { id: 'projectSlug', label: 'Project slug', type: 'text', required: true, placeholder: 'gh/org/repo' },
        { id: 'branch', label: 'Branch', type: 'text', placeholder: 'main' },
        { id: 'tag', label: 'Tag', type: 'text' },
        { id: 'parameters', label: 'Parameters (JSON)', type: 'json', placeholder: '{"deploy":true}' },
      ],
      run: pipelineTrigger,
    },
    {
      id: 'pipeline_get',
      label: 'Get pipeline',
      description: 'Fetch a pipeline by id.',
      fields: [
        { id: 'pipelineId', label: 'Pipeline ID', type: 'text', required: true },
      ],
      run: pipelineGet,
    },
    {
      id: 'workflow_cancel',
      label: 'Cancel workflow',
      description: 'Cancel a running workflow by id.',
      fields: [
        { id: 'workflowId', label: 'Workflow ID', type: 'text', required: true },
      ],
      run: workflowCancel,
    },
    {
      id: 'project_list',
      label: 'List collaborations',
      description: 'List orgs/accounts the token can see.',
      fields: [],
      run: projectList,
    },
  ],
};

registerForgeBlock(block);
export default block;
