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
  const toolUrl = asString(ctx.options.toolUrl);
  const input = asString(ctx.options.input);

  if (!toolUrl) throw new Error("AI Tool: toolUrl is required");
  if (!input) throw new Error("AI Tool: input is required");

  let parsedInput: unknown = input;
  try {
    parsedInput = JSON.parse(input);
  } catch {
    // Keep as string if not JSON
  }

  const res = await fetch(toolUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: toolName, input: parsedInput }),
  });

  const text = await res.text();
  let result: unknown = text;
  try {
    result = JSON.parse(text);
  } catch {
    /* keep as text */
  }

  if (!res.ok) {
    throw new Error(`AI Tool failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return {
    outputs: {
      result,
    },
    logs: [`Running AI Tool: ${toolName}`],
  };
}

const block: ForgeBlock = {
  id: "forge_ai_tool",
  name: "AI Tool",
  description: "An AI Tool that executes a REST payload and returns the result.",
  category: "Integration",
  iconName: "lu/LuWrench",
  fields: [
    {
      id: "toolName",
      type: "text",
      label: "Tool Name",
      required: true,
      helperText: "The name of the tool to execute.",
    },
    {
      id: "toolUrl",
      type: "text",
      label: "Tool Endpoint URL",
      required: true,
      helperText: "The REST API endpoint to call.",
    },
    {
      id: "input",
      type: "text",
      label: "Input",
      required: true,
      helperText: "Input arguments for the tool (JSON).",
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
export default block;
