/**
 * Forge block: Typebot Cards (image-card carousel input)
 *
 * Source: typebot.io-main/packages/blocks/inputs/cards/
 *
 * Typebot's signature card carousel — visitor is shown N cards (image +
 * title + description) and picks one (or many when `multiselect`).  The
 * actual rendering is handled by the SabFlow canvas + bot-engine; this
 * port is a *pure pass-through* shape so flows pasted from typebot keep
 * working without losing field data.
 *
 * Output:
 *   - { selection: string }              when multiselect = false
 *   - { selection: string[] }            when multiselect = true
 *
 * The runtime expects the picked value(s) to arrive in `selected` (set by
 * the canvas after the user clicks); this action just normalises the
 * shape and forwards.
 */

import { registerForgeBlock } from '../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../types';
import { asBoolean, asString } from '../n8n/_shared/http';

async function pick(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prompt = asString(ctx.options.prompt);
  const multiselect = asBoolean(ctx.options.multiselect);
  const raw = ctx.options.selected;

  let selection: string | string[];
  if (multiselect) {
    if (Array.isArray(raw)) {
      selection = raw.map((v) => asString(v)).filter((v) => v.length > 0);
    } else {
      const s = asString(raw);
      selection = s ? [s] : [];
    }
  } else {
    selection = Array.isArray(raw) ? asString(raw[0]) : asString(raw);
  }

  return {
    outputs: { selection },
    logs: [
      `Typebot cards pick → ${
        Array.isArray(selection) ? `${selection.length} item(s)` : selection || '∅'
      }${prompt ? ` (prompt: "${prompt.slice(0, 40)}")` : ''}`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_typebot_cards',
  name: 'Cards (typebot)',
  description:
    "Typebot's image-card carousel input. Renders an array of cards and emits the chosen card's value.",
  iconName: 'LuLayoutGrid',
  category: 'Input',
  auth: { type: 'none' },
  actions: [
    {
      id: 'pick',
      label: 'Pick card',
      description: 'Show a card carousel and forward the visitor\'s selection.',
      fields: [
        {
          id: 'prompt',
          label: 'Prompt',
          type: 'textarea',
          required: true,
          placeholder: 'Pick the option that best matches you',
        },
        {
          id: 'cards',
          label: 'Cards',
          type: 'json',
          required: true,
          placeholder:
            '[\n  { "imageUrl": "https://…", "title": "Plan A", "description": "…", "value": "a" }\n]',
          helperText:
            'Array of { imageUrl, title, description, value } objects rendered by the canvas.',
        },
        {
          id: 'multiselect',
          label: 'Allow multiple selections',
          type: 'toggle',
          defaultValue: false,
        },
        {
          id: 'selected',
          label: 'Selected value(s)',
          type: 'text',
          helperText:
            "Set by the canvas after the visitor picks. Manual edits override the visitor's choice.",
        },
      ],
      run: pick,
    },
  ],
};

registerForgeBlock(block);
export default block;
