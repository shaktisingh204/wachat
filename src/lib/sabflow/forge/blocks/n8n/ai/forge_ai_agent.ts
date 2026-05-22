/**
 * Forge block: Base AI Agent
 *
 * Implements a base AI agent block that wraps Langchain integration
 * as a native Forge block.
 */

import { registerForgeBlock } from "../../../registry";
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from "../../../types";
import { asString, requireCredential } from "../_shared/http";

async function runAgent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error("AI Agent: prompt is required");
  const model = asString(ctx.options.model) || "gpt-4o-mini";

  const cred = requireCredential('OpenAI', ctx.credential);
  const tokenField = cred.apiKey ? 'apiKey' : cred.accessToken ? 'accessToken' : 'apiKey';

  const res = await ctx.helpers!.requestWithAuthentication('bearer', {
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    tokenField,
    json: {
      model,
      messages: [{ role: "user", content: prompt }],
    },
  });

  if (!res.ok) {
    const clip = typeof res.data === 'string' ? res.data.slice(0, 300) : JSON.stringify(res.data).slice(0, 300);
    throw new Error(`AI Agent failed (${res.status}): ${clip}`);
  }

  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };

  return {
    outputs: {
      result: body?.choices?.[0]?.message?.content ?? "",
      raw: res.data,
    },
    logs: [`Executed AI Agent on ${model}`],
  };
}

const block: ForgeBlock = {
  id: "forge_ai_agent",
  name: "AI Agent",
  description: "An AI Agent that leverages LLMs to process prompts.",
  category: "Integration",
  iconName: "lu/LuBot",
  auth: { type: "apiKey", credentialType: "openai" },
  fields: [
    {
      name: "prompt",
      type: "text",
      label: "Prompt",
      required: true,
      description: "The instruction or prompt to pass to the agent.",
    },
    {
      name: "model",
      type: "text",
      label: "Model",
      description: "The model to use (e.g. gpt-4o-mini)",
      defaultValue: "gpt-4o-mini",
    },
  ],
  outputs: [{ name: "main" }],
  actions: [
    {
      id: "run_agent",
      label: "Run Agent",
      run: runAgent,
      fields: [],
    },
  ],
};

registerForgeBlock(block);
export default block;
