/**
 * Forge block: Sticky Note
 *
 * Source: n8n-master/packages/nodes-base/nodes/StickyNote/StickyNote.node.ts
 * Credential type: none.
 *
 * Runtime: purely declarative — does nothing at runtime. The n8n node is a
 * canvas annotation, not an executable step. We expose a `note` action that
 * returns the note text so imported n8n flows do not break. SabFlow's native
 * equivalent is a comment annotation on the canvas itself (no engine call).
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function note(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const content = asString(ctx.options.content);
  return { outputs: { note: content }, logs: ['StickyNote → no-op'] };
}

const block: ForgeBlock = {
  id: 'forge_sticky_note',
  name: 'Sticky Note',
  description: 'Canvas annotation — does nothing at runtime.',
  iconName: 'LuStickyNote',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'note',
      label: 'Note',
      description: 'Declarative annotation. Returns the note text unchanged.',
      fields: [
        {
          id: 'content',
          label: 'Note',
          type: 'textarea',
          placeholder: 'Anything you want to remember about this part of the flow…',
        },
      ],
      run: note,
    },
  ],
};

registerForgeBlock(block);
export default block;
