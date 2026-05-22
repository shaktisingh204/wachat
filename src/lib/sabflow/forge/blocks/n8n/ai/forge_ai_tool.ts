/**
 * Forge block: Base AI Tool
 *
 * Implements a base AI tool block that can be invoked by the AI agent.
 */

import { registerForgeBlock } from "../../../registry";
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from "../../../types";
import { asString } from "../_shared/http";

async function executeTool(
  ctx: ForgeActionContext,
): Promise<ForgeActionResult> {
  const toolName = asString(ctx.options.toolName);
  const input = asString(ctx.options.input);

  return {
    outputs: {
      result: `Executed tool ${toolName} with input: ${input}`,
    },
    logs: [`Running AI Tool: ${toolName}`],
  };
}

const block: ForgeBlock = {
  id: "forge_ai_tool",
  name: "AI Tool",
  description: "A base AI Tool that can be executed by Langchain agents.",
  category: "Integration",
  iconName: "lu/LuWrench",
  fields: [
    {
      name: "toolName",
      type: "string",
      label: "Tool Name",
      required: true,
      description: "The name of the tool to execute.",
    },
    {
      name: "input",
      type: "string",
      label: "Input",
      required: true,
      description: "Input arguments for the tool.",
    },
  ],
  outputs: [{ name: "main" }],
  actions: [
    {
      id: "execute_tool",
      label: "Execute Tool",
      run: executeTool,
      fields: [],
    },
  ],
};

registerForgeBlock(block);
