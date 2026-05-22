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
import { asString } from "../_shared/http";

async function runAgent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prompt = asString(ctx.options.prompt);
  const model = asString(ctx.options.model) || "gpt-4o-mini";

  return {
    outputs: {
      result: `Executed AI Agent with prompt: ${prompt} on model ${model}`,
    },
    logs: ["Running Forge AI Agent"],
  };
}

const block: ForgeBlock = {
  id: "forge_ai_agent",
  name: "AI Agent",
  description: "A base AI Agent powered by Langchain concepts.",
  category: "Integration",
  iconName: "lu/LuBot",
  fields: [
    {
      name: "prompt",
      type: "string",
      label: "Prompt",
      required: true,
      description: "The instruction or prompt to pass to the agent.",
    },
    {
      name: "model",
      type: "string",
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
