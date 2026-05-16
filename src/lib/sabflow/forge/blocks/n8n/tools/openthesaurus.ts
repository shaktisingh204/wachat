/**
 * Forge block: OpenThesaurus
 *
 * Source: n8n-master/packages/nodes-base/nodes/OpenThesaurus/OpenThesaurus.node.ts
 *
 * German thesaurus lookup — no auth required.
 *
 * Operations covered:
 *   - synonyms.lookup          GET /synonyme/search?q=…
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asString } from '../_shared/http';

const API = 'https://www.openthesaurus.de/synonyme/search';

async function synonymsLookup(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const word = asString(ctx.options.word);
  if (!word) throw new Error('OpenThesaurus: word is required');
  const params = new URLSearchParams({ q: word, format: 'application/json' });
  if (asBoolean(ctx.options.similar)) params.set('similar', 'true');
  if (asBoolean(ctx.options.substring)) params.set('substring', 'true');
  if (asBoolean(ctx.options.startsWith)) params.set('startswith', 'true');
  const supersynsets = asString(ctx.options.supersynsets);
  if (supersynsets) params.set('supersynsets', supersynsets);
  const baseform = asString(ctx.options.baseform);
  if (baseform) params.set('baseform', baseform);

  const res = await apiRequest({
    service: 'OpenThesaurus',
    method: 'GET',
    url: `${API}?${params.toString()}`,
  });
  return {
    outputs: { synonyms: res.data },
    logs: [`OpenThesaurus synonyms → ${word}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_openthesaurus',
  name: 'OpenThesaurus',
  description: 'Look up German synonyms via the OpenThesaurus REST API.',
  iconName: 'LuBookOpen',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'synonyms_lookup',
      label: 'Lookup synonyms',
      description: 'Fetch synonyms (and optional similar / substring matches) for a German word.',
      fields: [
        { id: 'word', label: 'Word', type: 'text', required: true, placeholder: 'Auto' },
        { id: 'similar', label: 'Include similar words', type: 'toggle' },
        { id: 'substring', label: 'Substring match', type: 'toggle' },
        { id: 'startsWith', label: 'Starts-with match', type: 'toggle' },
        { id: 'supersynsets', label: 'Include supersynsets (true/false)', type: 'text' },
        { id: 'baseform', label: 'Include baseform (true/false)', type: 'text' },
      ],
      run: synonymsLookup,
    },
  ],
};

registerForgeBlock(block);
export default block;
