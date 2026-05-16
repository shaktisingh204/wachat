/**
 * Forge block: BambooHR
 *
 * Source: n8n-master/packages/nodes-base/nodes/BambooHr/BambooHr.node.ts
 *
 * BambooHR uses Basic auth with `apiKey:x`.
 *
 * Operations covered:
 *   - employee.get        GET /employees/{id}
 *   - employee.list       GET /employees/directory
 *   - employee.create     POST /employees
 *   - timeOff.requests    GET /time_off/requests
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const sub = asString(ctx.options.subdomain);
  if (!sub) throw new Error('BambooHR: subdomain is required');
  return `https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(sub)}/v1`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('BambooHR: apiKey is required');
  return {
    Authorization: `Basic ${btoa(`${apiKey}:x`)}`,
    Accept: 'application/json',
  };
}

async function employeeGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.employeeId);
  if (!id) throw new Error('BambooHR: employeeId is required');
  const fields = asString(ctx.options.fields) || 'firstName,lastName,jobTitle,workEmail';
  const params = new URLSearchParams({ fields });
  const res = await apiRequest({
    service: 'BambooHR',
    method: 'GET',
    url: `${baseUrl(ctx)}/employees/${encodeURIComponent(id)}?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { employee: res.data }, logs: [`BambooHR employee get → ${id}`] };
}

async function employeeList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'BambooHR',
    method: 'GET',
    url: `${baseUrl(ctx)}/employees/directory`,
    headers: authHeaders(ctx),
  });
  return { outputs: { directory: res.data }, logs: ['BambooHR employee directory'] };
}

async function employeeCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (!firstName || !lastName) throw new Error('BambooHR: firstName and lastName are required');
  const body: Record<string, string> = { firstName, lastName };
  const email = asString(ctx.options.workEmail);
  if (email) body.workEmail = email;
  const jobTitle = asString(ctx.options.jobTitle);
  if (jobTitle) body.jobTitle = jobTitle;
  const res = await apiRequest({
    service: 'BambooHR',
    method: 'POST',
    url: `${baseUrl(ctx)}/employees`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data, location: res.headers.get('location') ?? null }, logs: [`BambooHR employee create → ${firstName} ${lastName}`] };
}

async function timeOffRequests(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const start = asString(ctx.options.start);
  const end = asString(ctx.options.end);
  const status = asString(ctx.options.status);
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  if (status) params.set('status', status);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'BambooHR',
    method: 'GET',
    url: `${baseUrl(ctx)}/time_off/requests${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { requests: res.data }, logs: ['BambooHR time-off requests'] };
}

const block: ForgeBlock = {
  id: 'forge_bamboohr',
  name: 'BambooHR',
  description: 'Manage BambooHR employees and time-off requests.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'employee_get',
      label: 'Get employee',
      description: 'Fetch a single employee by id.',
      fields: [
        { id: 'subdomain', label: 'Subdomain', type: 'text', required: true, placeholder: 'acme' },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'employeeId', label: 'Employee ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields (comma-separated)', type: 'text', placeholder: 'firstName,lastName,workEmail' },
      ],
      run: employeeGet,
    },
    {
      id: 'employee_list',
      label: 'List employees',
      description: 'Fetch the employee directory.',
      fields: [
        { id: 'subdomain', label: 'Subdomain', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: employeeList,
    },
    {
      id: 'employee_create',
      label: 'Create employee',
      description: 'Create a new employee record.',
      fields: [
        { id: 'subdomain', label: 'Subdomain', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'workEmail', label: 'Work email', type: 'text' },
        { id: 'jobTitle', label: 'Job title', type: 'text' },
      ],
      run: employeeCreate,
    },
    {
      id: 'timeoff_requests',
      label: 'List time-off requests',
      description: 'Fetch time-off requests within an optional window.',
      fields: [
        { id: 'subdomain', label: 'Subdomain', type: 'text', required: true },
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'start', label: 'Start date', type: 'text', placeholder: '2026-01-01' },
        { id: 'end', label: 'End date', type: 'text', placeholder: '2026-12-31' },
        { id: 'status', label: 'Status', type: 'text', placeholder: 'approved' },
      ],
      run: timeOffRequests,
    },
  ],
};

registerForgeBlock(block);
export default block;
