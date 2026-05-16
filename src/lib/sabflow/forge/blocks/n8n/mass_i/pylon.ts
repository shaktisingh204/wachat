/**
 * Forge block: Pylon
 *
 * API: https://docs.usepylon.com/pylon-docs/developer/api
 * Auth: `Authorization: Bearer <api_key>`.
 *
 * Operations covered:
 *   - issue.list                GET   /issues
 *   - issue.get                 GET   /issues/{id}
 *   - issue.create              POST  /issues
 *   - account.get               GET   /accounts/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.usepylon.com';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Pylon: apiKey is required');
  return { Authorization: `Bearer ${key}` };
}

function maybeJson(s: string): Record<string, unknown> {
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new Error('Pylon: JSON field is invalid');
  }
}

async function issueList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const startTime = asString(ctx.options.startTime);
  const endTime = asString(ctx.options.endTime);
  if (startTime) params.set('start_time', startTime);
  if (endTime) params.set('end_time', endTime);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Pylon',
    method: 'GET',
    url: `${API}/issues${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { issues: res.data }, logs: ['Pylon issue list'] };
}

async function issueGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.issueId);
  if (!id) throw new Error('Pylon: issueId is required');
  const res = await apiRequest({
    service: 'Pylon',
    method: 'GET',
    url: `${API}/issues/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { issue: res.data }, logs: [`Pylon issue get → ${id}`] };
}

async function issueCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const requesterEmail = asString(ctx.options.requesterEmail);
  if (!title) throw new Error('Pylon: title is required');
  const body: Record<string, unknown> = {
    title,
    ...maybeJson(asString(ctx.options.extra)),
  };
  if (requesterEmail) body.requester_email = requesterEmail;
  const bodyText = asString(ctx.options.body);
  if (bodyText) body.body_html = bodyText;
  const res = await apiRequest({
    service: 'Pylon',
    method: 'POST',
    url: `${API}/issues`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { issue: res.data }, logs: [`Pylon issue create → ${title}`] };
}

async function accountGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.accountId);
  if (!id) throw new Error('Pylon: accountId is required');
  const res = await apiRequest({
    service: 'Pylon',
    method: 'GET',
    url: `${API}/accounts/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { account: res.data }, logs: [`Pylon account get → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_pylon',
  name: 'Pylon',
  description: 'Pylon support — issues and accounts.',
  iconName: 'LuTicket',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'issue_list',
      label: 'List issues',
      description: 'List issues filtered by time range.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'startTime', label: 'Start time (ISO)', type: 'text' },
        { id: 'endTime', label: 'End time (ISO)', type: 'text' },
      ],
      run: issueList,
    },
    {
      id: 'issue_get',
      label: 'Get issue',
      description: 'Fetch a single issue by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'issueId', label: 'Issue ID', type: 'text', required: true },
      ],
      run: issueGet,
    },
    {
      id: 'issue_create',
      label: 'Create issue',
      description: 'Create a new issue.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'requesterEmail', label: 'Requester email', type: 'text' },
        { id: 'body', label: 'Body HTML', type: 'textarea' },
        { id: 'extra', label: 'Extra JSON', type: 'textarea' },
      ],
      run: issueCreate,
    },
    {
      id: 'account_get',
      label: 'Get account',
      description: 'Fetch an account by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
      ],
      run: accountGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
