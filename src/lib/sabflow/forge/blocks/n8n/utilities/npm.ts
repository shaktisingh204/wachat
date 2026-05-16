/**
 * Forge block: NPM
 *
 * Source: n8n-master/packages/nodes-base/nodes/Npm/Npm.node.ts
 *
 * Public registry — no auth required.
 *
 * Operations covered:
 *   - package.get   GET  https://registry.npmjs.org/{name}
 *   - search        GET  https://registry.npmjs.org/-/v1/search?text={q}
 *   - downloads     GET  https://api.npmjs.org/downloads/point/{period}/{name}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const REGISTRY = 'https://registry.npmjs.org';
const DOWNLOADS = 'https://api.npmjs.org';

async function packageGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.packageName);
  if (!name) throw new Error('NPM: packageName is required');
  const version = asString(ctx.options.version);
  const url = version
    ? `${REGISTRY}/${encodeURIComponent(name).replace(/%40/g, '@').replace(/%2F/g, '/')}/${encodeURIComponent(version)}`
    : `${REGISTRY}/${encodeURIComponent(name).replace(/%40/g, '@').replace(/%2F/g, '/')}`;
  const res = await apiRequest({
    service: 'NPM',
    method: 'GET',
    url,
  });
  return { outputs: { package: res.data }, logs: [`NPM package get → ${name}${version ? `@${version}` : ''}`] };
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.query);
  if (!text) throw new Error('NPM: query is required');
  const params = new URLSearchParams({ text });
  const size = asString(ctx.options.size);
  if (size) params.set('size', size);
  const res = await apiRequest({
    service: 'NPM',
    method: 'GET',
    url: `${REGISTRY}/-/v1/search?${params.toString()}`,
  });
  return { outputs: { results: res.data }, logs: [`NPM search → ${text}`] };
}

async function downloads(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.packageName);
  const period = asString(ctx.options.period) || 'last-week';
  if (!name) throw new Error('NPM: packageName is required');
  const res = await apiRequest({
    service: 'NPM',
    method: 'GET',
    url: `${DOWNLOADS}/downloads/point/${encodeURIComponent(period)}/${encodeURIComponent(name).replace(/%40/g, '@').replace(/%2F/g, '/')}`,
  });
  return { outputs: { downloads: res.data }, logs: [`NPM downloads → ${name} (${period})`] };
}

const PERIOD_OPTIONS = [
  { label: 'Last day', value: 'last-day' },
  { label: 'Last week', value: 'last-week' },
  { label: 'Last month', value: 'last-month' },
  { label: 'Last year', value: 'last-year' },
];

const block: ForgeBlock = {
  id: 'forge_npm',
  name: 'NPM',
  description: 'Query the public npm registry for packages, search and download counts.',
  iconName: 'LuPackage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'package_get',
      label: 'Get package',
      description: 'Fetch metadata for an npm package.',
      fields: [
        { id: 'packageName', label: 'Package name', type: 'text', required: true, placeholder: 'lodash' },
        { id: 'version', label: 'Version (optional)', type: 'text' },
      ],
      run: packageGet,
    },
    {
      id: 'search',
      label: 'Search packages',
      description: 'Full-text search the npm registry.',
      fields: [
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'size', label: 'Size', type: 'number' },
      ],
      run: search,
    },
    {
      id: 'downloads',
      label: 'Get downloads',
      description: 'Get download counts for a package over a period.',
      fields: [
        { id: 'packageName', label: 'Package name', type: 'text', required: true },
        { id: 'period', label: 'Period', type: 'select', options: PERIOD_OPTIONS, defaultValue: 'last-week' },
      ],
      run: downloads,
    },
  ],
};

registerForgeBlock(block);
export default block;
