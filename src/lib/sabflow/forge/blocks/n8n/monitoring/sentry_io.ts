/**
 * Forge block: Sentry.io
 *
 * Source: n8n-master/packages/nodes-base/nodes/SentryIo/SentryIo.node.ts
 * Credential type: 'sentry_io' → { baseUrl?, authToken }.
 *
 * Operations covered:
 *   - issue.list           GET  /projects/{org}/{project}/issues/
 *   - issue.get            GET  /issues/{issueId}/
 *   - event.list           GET  /projects/{org}/{project}/events/
 *   - event.get            GET  /projects/{org}/{project}/events/{eventId}/
 *   - release.create       POST /organizations/{org}/releases/
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const DEFAULT_BASE = 'https://sentry.io/api/0';

function ctxAuth(ctx: ForgeActionContext): { base: string; token: string } {
  const cred = requireCredential('Sentry', ctx.credential);
  const token = cred.authToken ?? cred.apiKey ?? '';
  if (!token) throw new Error('Sentry: credential is missing `authToken`');
  const base = (cred.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
  return { base, token };
}

async function sentryRequest(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, token } = ctxAuth(ctx);
  const res = await apiRequest({
    service: 'Sentry',
    method,
    url: `${base}${path.startsWith('/') ? path : `/${path}`}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

async function issueList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const org = asString(ctx.options.organizationSlug);
  const project = asString(ctx.options.projectSlug);
  if (!org) throw new Error('Sentry: organizationSlug is required');
  if (!project) throw new Error('Sentry: projectSlug is required');
  const data = await sentryRequest(ctx, 'GET', `/projects/${org}/${project}/issues/`);
  return { outputs: { issues: data }, logs: [`Sentry issue list → ${org}/${project}`] };
}

async function issueGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const issueId = asString(ctx.options.issueId);
  if (!issueId) throw new Error('Sentry: issueId is required');
  const data = await sentryRequest(ctx, 'GET', `/issues/${issueId}/`);
  return { outputs: { issue: data }, logs: [`Sentry issue get → ${issueId}`] };
}

async function eventList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const org = asString(ctx.options.organizationSlug);
  const project = asString(ctx.options.projectSlug);
  if (!org) throw new Error('Sentry: organizationSlug is required');
  if (!project) throw new Error('Sentry: projectSlug is required');
  const data = await sentryRequest(ctx, 'GET', `/projects/${org}/${project}/events/`);
  return { outputs: { events: data }, logs: [`Sentry event list → ${org}/${project}`] };
}

async function eventGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const org = asString(ctx.options.organizationSlug);
  const project = asString(ctx.options.projectSlug);
  const eventId = asString(ctx.options.eventId);
  if (!org || !project) throw new Error('Sentry: organizationSlug and projectSlug are required');
  if (!eventId) throw new Error('Sentry: eventId is required');
  const data = await sentryRequest(ctx, 'GET', `/projects/${org}/${project}/events/${eventId}/`);
  return { outputs: { event: data }, logs: [`Sentry event get → ${eventId}`] };
}

async function releaseCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const org = asString(ctx.options.organizationSlug);
  const version = asString(ctx.options.version);
  if (!org) throw new Error('Sentry: organizationSlug is required');
  if (!version) throw new Error('Sentry: version is required');

  const body: Record<string, unknown> = { version };
  const ref = asString(ctx.options.ref);
  const url = asString(ctx.options.url);
  const projects = asString(ctx.options.projects);
  if (ref) body.ref = ref;
  if (url) body.url = url;
  if (projects) body.projects = projects.split(',').map((s) => s.trim()).filter(Boolean);

  const data = await sentryRequest(ctx, 'POST', `/organizations/${org}/releases/`, body);
  return { outputs: { release: data }, logs: [`Sentry release create → ${version}`] };
}

const block: ForgeBlock = {
  id: 'forge_sentry_io',
  name: 'Sentry.io',
  description: 'List Sentry issues/events and ship new releases from a flow.',
  iconName: 'LuShieldAlert',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'sentry_io' },
  actions: [
    {
      id: 'issue_list',
      label: 'List issues',
      description: 'List issues for a project.',
      fields: [
        { id: 'organizationSlug', label: 'Organization slug', type: 'text', required: true },
        { id: 'projectSlug', label: 'Project slug', type: 'text', required: true },
      ],
      run: issueList,
    },
    {
      id: 'issue_get',
      label: 'Get issue',
      description: 'Fetch a single Sentry issue.',
      fields: [{ id: 'issueId', label: 'Issue ID', type: 'text', required: true }],
      run: issueGet,
    },
    {
      id: 'event_list',
      label: 'List events',
      description: 'List events for a project.',
      fields: [
        { id: 'organizationSlug', label: 'Organization slug', type: 'text', required: true },
        { id: 'projectSlug', label: 'Project slug', type: 'text', required: true },
      ],
      run: eventList,
    },
    {
      id: 'event_get',
      label: 'Get event',
      description: 'Fetch a single event.',
      fields: [
        { id: 'organizationSlug', label: 'Organization slug', type: 'text', required: true },
        { id: 'projectSlug', label: 'Project slug', type: 'text', required: true },
        { id: 'eventId', label: 'Event ID', type: 'text', required: true },
      ],
      run: eventGet,
    },
    {
      id: 'release_create',
      label: 'Create release',
      description: 'Create a new release in Sentry.',
      fields: [
        { id: 'organizationSlug', label: 'Organization slug', type: 'text', required: true },
        { id: 'version', label: 'Version', type: 'text', required: true, placeholder: '1.0.0' },
        { id: 'ref', label: 'Ref (commit SHA)', type: 'text' },
        { id: 'url', label: 'Release URL', type: 'text' },
        { id: 'projects', label: 'Projects (comma-separated slugs)', type: 'text' },
      ],
      run: releaseCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
