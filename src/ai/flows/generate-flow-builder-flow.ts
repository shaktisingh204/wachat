
'use server';
/**
 * @fileOverview Generates a complete flow (nodes and edges) for the Flow Builder from a user prompt.
 *
 * This file defines the `generateFlowBuilderFlow` function, which takes a user's prompt
 * and generates a valid Flow Builder JSON object.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Zod Schemas for Flow Builder Structure ---

const PositionSchema = z.object({
  x: z.number().describe('The x-coordinate for the node\'s position on the canvas.'),
  y: z.number().describe('The y-coordinate for the node\'s position on the canvas.'),
});

const FlowNodeDataSchema = z.object({
    label: z.string().describe('A short, descriptive label for the node block.'),
    text: z.string().optional().describe('The text content for message-based nodes like `text` or `buttons`.'),
    triggerKeywords: z.string().optional().describe('For `start` nodes, a comma-separated list of keywords that trigger the flow.'),
    buttons: z.array(z.object({ id: z.string(), type: z.literal('QUICK_REPLY'), text: z.string() })).optional().describe('An array of buttons for `buttons` nodes.'),
    variableToSave: z.string().optional().describe('For `input` nodes, the name of the variable to save the user\'s response to (e.g., "user_name").'),
    conditionType: z.enum(['variable', 'user_response']).optional().describe('For `condition` nodes, what to check.'),
    variable: z.string().optional().describe('For `condition` nodes, the variable to check (e.g., "{{user_name}}").'),
    operator: z.string().optional().describe('For `condition` nodes, the comparison operator (e.g., "equals", "contains").'),
    value: z.string().optional().describe('For `condition` nodes, the value to compare against.'),
}).passthrough();

const FlowNodeSchema = z.object({
  id: z.string().describe('A unique identifier for the node, e.g., "node-start" or "node-text-123".'),
  type: z.enum(['start', 'text', 'buttons', 'condition', 'input', 'delay', 'api', 'image', 'carousel', 'addToCart', 'language', 'sendTemplate', 'triggerMetaFlow', 'triggerFlow']).describe('The type of the node.'),
  data: FlowNodeDataSchema.describe('The configuration data for the node.'),
  position: PositionSchema.describe('The position of the node on the canvas.'),
});

const FlowEdgeSchema = z.object({
  id: z.string().describe('A unique identifier for the edge, e.g., "edge-node1-node2".'),
  source: z.string().describe('The ID of the source node.'),
  target: z.string().describe('The ID of the target node.'),
  sourceHandle: z.string().optional().describe('The specific output handle on the source node (e.g., "output-main", "output-yes", "btn-0").'),
  targetHandle: z.string().optional().describe('The specific input handle on the target node (usually "input").'),
});

const GenerateFlowBuilderFlowOutputSchema = z.object({
  nodes: z.array(FlowNodeSchema).describe('An array of all nodes in the flow.'),
  edges: z.array(FlowEdgeSchema).describe('An array of all edges connecting the nodes.'),
});
type GenerateFlowBuilderFlowOutput = z.infer<typeof GenerateFlowBuilderFlowOutputSchema>;

const GenerateFlowBuilderFlowInputSchema = z.object({
  prompt: z.string().describe("The user's description of the flow they want to create."),
});
type GenerateFlowBuilderFlowInput = z.infer<typeof GenerateFlowBuilderFlowInputSchema>;

export async function generateFlowBuilderFlow(input: GenerateFlowBuilderFlowInput): Promise<GenerateFlowBuilderFlowOutput> {
  return generateFlowBuilderFlowFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFlowBuilderFlowPrompt',
  input: { schema: GenerateFlowBuilderFlowInputSchema },
  output: { schema: GenerateFlowBuilderFlowOutputSchema },
  prompt: `You are an expert at creating conversational flows for WhatsApp for a no-code flow builder. Your task is to generate a valid JSON object containing 'nodes' and 'edges' arrays based on a user's prompt.

RULES:
1.  **Start Node**: Every flow MUST begin with one 'start' node.
2.  **Layout**: Position nodes from left to right. Increment the 'x' position for each step in the flow (e.g., by 300-400). Use the 'y' position to separate branches.
3.  **Connectivity**: Ensure every node (except the end of a branch) is connected via an edge. All non-start nodes must have an incoming connection.
4.  **Node IDs**: Generate unique and descriptive node IDs (e.g., "node-start", "node-ask-name", "edge-ask-name-to-thank-you").
5.  **Handles**:
    - Standard nodes have one output handle: "output-main".
    - 'buttons' nodes have one output handle per button: "btn-0", "btn-1", etc.
    - 'condition' nodes have two output handles: "output-yes" and "output-no".
    - All non-start nodes have one input handle: "input".
6.  **Available Node Types**: Use only the following node types: 'start', 'text', 'buttons', 'input', 'condition'.

USER PROMPT:
"{{{prompt}}}"

Generate the JSON now.`,
});

const generateFlowBuilderFlowFlow = ai.defineFlow(
  {
    name: 'generateFlowBuilderFlowFlow',
    inputSchema: GenerateFlowBuilderFlowInputSchema,
    outputSchema: GenerateFlowBuilderFlowOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
