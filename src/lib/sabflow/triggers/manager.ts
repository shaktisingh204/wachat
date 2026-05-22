import type { SabFlowDoc, SabFlowWebhook } from '../types';
import { getForgeBlock } from '../forge/registry';
import type { ForgeTriggerHooks, ForgeActionContext } from '../forge/types';
import { getSabFlowWebhooksCollection } from '../db';
// We don't have a resolve credential helper easily accessible here without knowing the auth format.
// But we can just use the credentials DB if needed.

export async function registerTriggerBlocks(
  flow: SabFlowDoc,
  userId: string,
  webhooks: Array<{ appEvent: string; webhookId: string; webhookUrl: string }>
): Promise<void> {
  const blocks = flow.groups?.flatMap((g) => g.blocks) ?? [];
  const col = await getSabFlowWebhooksCollection();

  for (const block of blocks) {
    if (block.type.startsWith('forge_')) {
      const forgeBlock = getForgeBlock(block.type);
      if (forgeBlock?.triggerHooks?.register) {
        const webhook = webhooks[0];
        if (!webhook) continue;

        const ctx: ForgeActionContext & { webhookUrl: string } = {
          options: block.options ?? {},
          variables: {},
          userId,
          webhookUrl: webhook.webhookUrl,
        };

        try {
          const triggerData = await forgeBlock.triggerHooks.register(ctx);
          if (triggerData) {
            await col.updateOne(
              { webhookId: webhook.webhookId },
              { $set: { triggerData } }
            );
          }
        } catch (error) {
          console.error(`Failed to register trigger for block ${block.type}:`, error);
        }
      }
    }
  }
}

export async function deregisterTriggerBlocks(
  flow: SabFlowDoc,
  userId: string,
  webhooks: SabFlowWebhook[]
): Promise<void> {
  const blocks = flow.groups?.flatMap((g) => g.blocks) ?? [];

  for (const block of blocks) {
    if (block.type.startsWith('forge_')) {
      const forgeBlock = getForgeBlock(block.type);
      if (forgeBlock?.triggerHooks?.deregister) {
        const webhook = webhooks[0];
        if (!webhook || !webhook.triggerData) continue;

        const ctx: ForgeActionContext = {
          options: block.options ?? {},
          variables: {},
          userId,
        };

        try {
          await forgeBlock.triggerHooks.deregister(ctx, webhook.triggerData);
        } catch (error) {
          console.error(`Failed to deregister trigger for block ${block.type}:`, error);
        }
      }
    }
  }
}
