/**
 * Forge block: Form (n8n)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Form/Form.node.ts
 * Credential type: none.
 *
 * Runtime: returns the form spec as JSON — does NOT render an HTTP form. n8n
 * exposes Forms as webhook-backed surveys; SabFlow has native input blocks
 * (text, select, etc.) and dedicated form workflows. This port is for n8n
 * migration parity only — wire it to a SabFlow input block for live use.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function defineForm(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const fields = ctx.options.fields;
  const spec = {
    title,
    description: asString(ctx.options.description),
    fields: Array.isArray(fields) ? fields : fields && typeof fields === 'object' ? fields : [],
  };
  return { outputs: { formSpec: spec }, logs: [`Form define → "${title || 'untitled'}"`] };
}

const block: ForgeBlock = {
  id: 'forge_form_n8n',
  name: 'Form (Legacy)',
  description: 'Define a form spec (declarative — use SabFlow input blocks at runtime).',
  iconName: 'LuClipboardList',
  category: 'Input',
  auth: { type: 'none' },
  actions: [
    {
      id: 'define_form',
      label: 'Define form',
      description: 'Build a form schema for legacy migration parity.',
      fields: [
        { id: 'title', label: 'Form title', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        {
          id: 'fields',
          label: 'Fields',
          type: 'json',
          placeholder: '[{"name":"email","type":"email","required":true}]',
          helperText: 'JSON array describing each form field.',
        },
      ],
      run: defineForm,
    },
  ],
};

registerForgeBlock(block);
export default block;
