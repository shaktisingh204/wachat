/**
 * Forge block: Legacy Variants Info
 *
 * Purpose: a tiny metadata-only block that lists the n8n version variants
 * SabFlow's forge surface intentionally collapses into a single block.
 *
 * Many n8n integrations ship multiple node-type versions (Discord V1/V2,
 * Mattermost V1/V2, Twitter V1/V2, etc.) — the forge ports merge those
 * into a single block targeting the latest stable surface. This block
 * exists so migration tooling and humans can introspect which legacy
 * variants are NOT individually re-exported, and where to look for the
 * replacement.
 *
 * Operations covered:
 *   - list_legacy_variants → static informational array
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

type Variant = {
  service: string;
  legacy: string;
  current: string;
  forgeBlock: string;
  note: string;
};

const VARIANTS: Variant[] = [
  {
    service: 'Discord',
    legacy: 'Discord (V1, webhook-only)',
    current: 'Discord V2 (bot + webhook)',
    forgeBlock: 'forge_discord',
    note: 'Forge port targets V2. The V1 webhook-only surface is reachable via the same block by leaving `botToken` empty and supplying `webhookUrl`.',
  },
  {
    service: 'Mattermost',
    legacy: 'Mattermost (V1)',
    current: 'Mattermost V2',
    forgeBlock: 'forge_mattermost',
    note: 'Forge port targets V2 endpoints (/api/v4). V1 (/api/v3) is dead upstream.',
  },
  {
    service: 'Twitter',
    legacy: 'Twitter V1 (free tier, OAuth1a)',
    current: 'Twitter V2 (paid, OAuth2)',
    forgeBlock: 'forge_twitter',
    note: 'Forge port targets V2 (`api.twitter.com/2`). V1 endpoints are mostly deprecated.',
  },
  {
    service: 'Spotify',
    legacy: 'Spotify (multiple param versions)',
    current: 'Spotify (current)',
    forgeBlock: 'forge_spotify',
    note: 'Single block — Spotify never split into V1/V2 node types in n8n.',
  },
  {
    service: 'Set',
    legacy: 'Set (V1, single-mode)',
    current: 'Set V2 (manual / json modes)',
    forgeBlock: 'forge_set',
    note: 'Forge port covers both modes via field switches.',
  },
  {
    service: 'Function',
    legacy: 'Function / FunctionItem (deprecated)',
    current: 'Code (n8n)',
    forgeBlock: 'forge_code_n8n',
    note: 'See also forge_function_legacy and forge_function_item_legacy for parity ports.',
  },
  {
    service: 'AI Transform',
    legacy: 'AI Transform V1 (coupled generate+run)',
    current: 'AI Transform (split surface)',
    forgeBlock: 'forge_ai_transform',
    note: 'See forge_ai_transform_v1 for the legacy coupled flow.',
  },
  {
    service: 'TheHive',
    legacy: 'TheHive (v3/v4)',
    current: 'TheHive Project (v5)',
    forgeBlock: 'forge_thehive_project',
    note: 'forge_thehive covers the legacy v3/v4 endpoints; forge_thehive_project covers v5.',
  },
  {
    service: 'Compare Datasets',
    legacy: 'Compare Datasets (1, 2, 2.1-2.3)',
    current: 'native filter/merge composition',
    forgeBlock: 'forge_compare_datasets',
    note: 'Forge port is migration-parity only — dual-input/quad-output topology is collapsed to a single overlap call.',
  },
];

async function listLegacyVariants(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return {
    outputs: { variants: VARIANTS, count: VARIANTS.length },
    logs: [`Legacy variants info → ${VARIANTS.length} entries`],
  };
}

const block: ForgeBlock = {
  id: 'forge_legacy_variants_info',
  name: 'Legacy Variants (info)',
  description: 'Static metadata listing legacy node version variants that the SabFlow forge surface intentionally collapses.',
  iconName: 'LuInfo',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_legacy_variants',
      label: 'List variants',
      description: 'Return the static array of legacy variant entries.',
      fields: [],
      run: listLegacyVariants,
    },
  ],
};

registerForgeBlock(block);
export default block;
