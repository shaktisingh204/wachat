/**
 * Forge block: SecurityScorecard
 *
 * Source: n8n-master/packages/nodes-base/nodes/SecurityScorecard/SecurityScorecard.node.ts
 *
 * Auth: `Authorization: Token <apiKey>` against api.securityscorecard.io.
 *
 * Operations covered:
 *   - portfolio.list   GET /portfolios
 *   - portfolio.get    GET /portfolios/{id}/companies
 *   - company.score    GET /companies/{domain}
 *   - company.factors  GET /companies/{domain}/factors
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.securityscorecard.io';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('SecurityScorecard: apiKey is required');
  return { Authorization: `Token ${key}` };
}

async function portfolioList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'SecurityScorecard',
    method: 'GET',
    url: `${API}/portfolios`,
    headers: authHeader(ctx),
  });
  return { outputs: { portfolios: res.data }, logs: ['SecurityScorecard portfolio.list'] };
}

async function portfolioCompanies(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.portfolioId);
  if (!id) throw new Error('SecurityScorecard: portfolioId is required');
  const res = await apiRequest({
    service: 'SecurityScorecard',
    method: 'GET',
    url: `${API}/portfolios/${encodeURIComponent(id)}/companies`,
    headers: authHeader(ctx),
  });
  return { outputs: { companies: res.data }, logs: [`SecurityScorecard portfolio.companies → ${id}`] };
}

async function companyScore(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  if (!domain) throw new Error('SecurityScorecard: domain is required');
  const res = await apiRequest({
    service: 'SecurityScorecard',
    method: 'GET',
    url: `${API}/companies/${encodeURIComponent(domain)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { company: res.data }, logs: [`SecurityScorecard company.score → ${domain}`] };
}

async function companyFactors(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  if (!domain) throw new Error('SecurityScorecard: domain is required');
  const res = await apiRequest({
    service: 'SecurityScorecard',
    method: 'GET',
    url: `${API}/companies/${encodeURIComponent(domain)}/factors`,
    headers: authHeader(ctx),
  });
  return { outputs: { factors: res.data }, logs: [`SecurityScorecard company.factors → ${domain}`] };
}

const credFields = [
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_security_scorecard',
  name: 'SecurityScorecard',
  description: 'Inspect SecurityScorecard portfolios and per-company ratings.',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'portfolio_list',
      label: 'List portfolios',
      description: 'List portfolios visible to the API key.',
      fields: [...credFields],
      run: portfolioList,
    },
    {
      id: 'portfolio_companies',
      label: 'List portfolio companies',
      description: 'List companies inside a portfolio.',
      fields: [
        ...credFields,
        { id: 'portfolioId', label: 'Portfolio ID', type: 'text', required: true },
      ],
      run: portfolioCompanies,
    },
    {
      id: 'company_score',
      label: 'Get company score',
      description: 'Fetch the overall SecurityScorecard rating for a domain.',
      fields: [
        ...credFields,
        { id: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'example.com' },
      ],
      run: companyScore,
    },
    {
      id: 'company_factors',
      label: 'Get company factor scores',
      description: 'Fetch the per-factor breakdown for a domain.',
      fields: [
        ...credFields,
        { id: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'example.com' },
      ],
      run: companyFactors,
    },
  ],
};

registerForgeBlock(block);
export default block;
