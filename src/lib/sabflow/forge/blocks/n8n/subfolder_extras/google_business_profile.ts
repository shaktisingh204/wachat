/**
 * Forge block: Google Business Profile
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/BusinessProfile/GoogleBusinessProfile.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline.
 *
 * Hosts:
 *   - mybusinessaccountmanagement.googleapis.com/v1   (accounts)
 *   - mybusinessbusinessinformation.googleapis.com/v1 (locations)
 *   - mybusiness.googleapis.com/v4                    (posts, reviews)
 *
 * Operations:
 *   - location.list    GET /v1/{account}/locations            (BusinessInformation)
 *   - post.create      POST /v4/{account}/{location}/localPosts
 *   - review.list      GET /v4/{account}/{location}/reviews
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, GOOGLE_TOKEN_URL } from '../_shared/google_oauth';

const SERVICE = 'Google Business Profile';
const INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const V4_BASE = 'https://mybusiness.googleapis.com/v4';

function readCred(ctx: ForgeActionContext): Record<string, string> {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, readCred(ctx), GOOGLE_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

async function locationList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const account = asString(ctx.options.account);
  if (!account) throw new Error(`${SERVICE}: account (e.g. accounts/123) is required`);
  const readMask = asString(ctx.options.readMask) || 'name,title,storefrontAddress';
  const url = `${INFO_BASE}/${account}/locations?readMask=${encodeURIComponent(readMask)}`;
  const data = await call(ctx, 'GET', url);
  return { outputs: { result: data }, logs: [`Locations list → ${account}`] };
}

async function postCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const account = asString(ctx.options.account);
  const location = asString(ctx.options.location);
  const summary = asString(ctx.options.summary);
  const languageCode = asString(ctx.options.languageCode) || 'en-US';
  const topicType = asString(ctx.options.topicType) || 'STANDARD';
  if (!account) throw new Error(`${SERVICE}: account is required`);
  if (!location) throw new Error(`${SERVICE}: location is required`);
  if (!summary) throw new Error(`${SERVICE}: summary is required`);
  const body: Record<string, unknown> = { summary, languageCode, topicType };
  const url = `${V4_BASE}/${account}/${location}/localPosts`;
  const data = await call(ctx, 'POST', url, body);
  return { outputs: { result: data }, logs: [`Local post create → ${location}`] };
}

async function reviewList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const account = asString(ctx.options.account);
  const location = asString(ctx.options.location);
  if (!account) throw new Error(`${SERVICE}: account is required`);
  if (!location) throw new Error(`${SERVICE}: location is required`);
  const pageSize = asString(ctx.options.pageSize);
  const qs = pageSize ? `?pageSize=${encodeURIComponent(pageSize)}` : '';
  const url = `${V4_BASE}/${account}/${location}/reviews${qs}`;
  const data = await call(ctx, 'GET', url);
  return { outputs: { result: data }, logs: [`Reviews list → ${location}`] };
}

const block: ForgeBlock = {
  id: 'forge_google_business_profile',
  name: 'Google Business Profile',
  description: 'List locations, create local posts, and read reviews on Google Business Profile.',
  iconName: 'LuStore',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'location_list',
      label: 'List locations',
      description: 'List business locations under an account.',
      fields: [
        ...authFields,
        { id: 'account', label: 'Account (e.g. accounts/123)', type: 'text', required: true },
        { id: 'readMask', label: 'Read mask (fields)', type: 'text', placeholder: 'name,title,storefrontAddress' },
      ],
      run: locationList,
    },
    {
      id: 'post_create',
      label: 'Create local post',
      description: 'Publish a local post on a location.',
      fields: [
        ...authFields,
        { id: 'account', label: 'Account (accounts/123)', type: 'text', required: true },
        { id: 'location', label: 'Location (locations/456)', type: 'text', required: true },
        { id: 'summary', label: 'Summary', type: 'textarea', required: true },
        { id: 'languageCode', label: 'Language code', type: 'text', placeholder: 'en-US' },
        { id: 'topicType', label: 'Topic type', type: 'text', placeholder: 'STANDARD' },
      ],
      run: postCreate,
    },
    {
      id: 'review_list',
      label: 'List reviews',
      description: 'List reviews for a location.',
      fields: [
        ...authFields,
        { id: 'account', label: 'Account', type: 'text', required: true },
        { id: 'location', label: 'Location', type: 'text', required: true },
        { id: 'pageSize', label: 'Page size', type: 'number' },
      ],
      run: reviewList,
    },
  ],
};

registerForgeBlock(block);
export default block;
