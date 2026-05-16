/**
 * Forge block: Brandfetch
 *
 * Source: n8n-master/packages/nodes-base/nodes/Brandfetch/Brandfetch.node.ts
 * Credential type: 'brandfetch' (CREDENTIAL_FIELD_SCHEMAS → { apiKey }).
 *
 * Auth: Bearer apiKey, base `https://api.brandfetch.io/v2`.
 *
 * Operations covered:
 *   - brand.retrieve     GET  /brands/{domain}        — full brand data
 *   - brand.search       GET  /search/{query}         — search brands by name
 *   - brand.logo         derived from retrieve        — returns just the logos[] subset
 *   - brand.color        derived from retrieve        — returns just the colors[] subset
 *   - brand.font         derived from retrieve        — returns just the fonts[] subset
 *
 * Deferred:
 *   - logo binary download (handled by SabFiles); we always return URLs
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.brandfetch.io/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Brandfetch', ctx.credential);
  const apiKey = cred.apiKey;
  if (!apiKey) throw new Error('Brandfetch: credential is missing `apiKey`');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

async function fetchBrand(ctx: ForgeActionContext, domain: string): Promise<Record<string, unknown>> {
  const res = await apiRequest({
    service: 'Brandfetch',
    method: 'GET',
    url: `${BASE}/brands/${encodeURIComponent(domain)}`,
    headers: authHeaders(ctx),
  });
  return (res.data as Record<string, unknown>) ?? {};
}

// ── Actions ────────────────────────────────────────────────────────────────

async function brandRetrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  if (!domain) throw new Error('Brandfetch: domain is required');
  const data = await fetchBrand(ctx, domain);
  return {
    outputs: { brand: data },
    logs: [`Brandfetch retrieve → ${domain}`],
  };
}

async function brandSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Brandfetch: query is required');
  const res = await apiRequest({
    service: 'Brandfetch',
    method: 'GET',
    url: `${BASE}/search/${encodeURIComponent(query)}`,
    headers: authHeaders(ctx),
  });
  const list = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { results: list, count: list.length },
    logs: [`Brandfetch search → "${query}" → ${list.length}`],
  };
}

async function brandLogos(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  if (!domain) throw new Error('Brandfetch: domain is required');
  const data = await fetchBrand(ctx, domain);
  const logos = Array.isArray(data.logos) ? data.logos : [];
  return {
    outputs: { logos, count: logos.length },
    logs: [`Brandfetch logos → ${domain} → ${logos.length}`],
  };
}

async function brandColors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  if (!domain) throw new Error('Brandfetch: domain is required');
  const data = await fetchBrand(ctx, domain);
  const colors = Array.isArray(data.colors) ? data.colors : [];
  return {
    outputs: { colors, count: colors.length },
    logs: [`Brandfetch colors → ${domain} → ${colors.length}`],
  };
}

async function brandFonts(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  if (!domain) throw new Error('Brandfetch: domain is required');
  const data = await fetchBrand(ctx, domain);
  const fonts = Array.isArray(data.fonts) ? data.fonts : [];
  return {
    outputs: { fonts, count: fonts.length },
    logs: [`Brandfetch fonts → ${domain} → ${fonts.length}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_brandfetch',
  name: 'Brandfetch',
  description: 'Fetch brand logos, colors and fonts from Brandfetch.',
  iconName: 'LuPalette',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'brandfetch',
  },
  actions: [
    {
      id: 'brand_retrieve',
      label: 'Retrieve brand',
      description: 'Fetch the full brand profile for a domain.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'example.com' },
      ],
      run: brandRetrieve,
    },
    {
      id: 'brand_search',
      label: 'Search brands',
      description: 'Search brands by name.',
      fields: [
        { id: 'query', label: 'Search query', type: 'text', required: true },
      ],
      run: brandSearch,
    },
    {
      id: 'brand_logos',
      label: 'Get logos',
      description: 'Return only the logos array for a domain.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true },
      ],
      run: brandLogos,
    },
    {
      id: 'brand_colors',
      label: 'Get colors',
      description: 'Return only the brand colors for a domain.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true },
      ],
      run: brandColors,
    },
    {
      id: 'brand_fonts',
      label: 'Get fonts',
      description: 'Return only the brand fonts for a domain.',
      fields: [
        { id: 'domain', label: 'Domain', type: 'text', required: true },
      ],
      run: brandFonts,
    },
  ],
};

registerForgeBlock(block);
export default block;
