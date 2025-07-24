
'use server';
/**
 * @fileOverview Generates a complete automation workflow (nodes and edges) for the CRM from a user prompt.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Zod Schemas for CRM Automation Structure ---

const PositionSchema = z.object({
  x: z.number().describe('The x-coordinate for the node\'s position on the canvas.'),
  y: z.number().describe('The y-coordinate for the node\'s position on the canvas.'),
});

const CrmNodeDataSchema = z.object({
    label: z.string().describe('A short, descriptive label for the node block.'),
    tagName: z.string().optional().describe('For `triggerTagAdded` or `actionAddTag`, the name of the tag.'),
    taskTitle: z.string().optional().describe('For `actionCreateTask`, the title of the task to create.'),
    templateId: z.string().optional().describe('For `actionSendEmail`, the ID of the email template to send.'),
    delayValue: z.number().optional().describe('For `delay` nodes, the numeric value for the delay.'),
    delayUnit: z.enum(['minutes', 'hours', 'days']).optional().describe('For `delay` nodes, the unit of time for the delay.'),
    variable: z.string().optional().describe('For `condition` nodes, the variable to check (e.g., "{{contact.status}}").'),
    operator: z.enum(['equals', 'not_equals', 'contains']).optional().describe('For `condition` nodes, the comparison operator.'),
    value: z.string().optional().describe('For `condition` nodes, the value to compare against.'),
});

const CrmAutomationNodeSchema = z.object({
  id: z.string().describe('A unique identifier for the node, e.g., "node-start" or "node-text-123".'),
  type: z.enum(['triggerTagAdded', 'actionSendEmail', 'actionCreateTask', 'actionAddTag', 'delay', 'condition']).describe('The type of the node.'),
  data: CrmNodeDataSchema.describe('The configuration data for the node.'),
  position: PositionSchema.describe('The position of the node on the canvas.'),
});

const CrmAutomationEdgeSchema = z.object({
  id: z.string().describe('A unique identifier for the edge, e.g., "edge-node1-node2".'),
  source: z.string().describe('The ID of the source node.'),
  target: z.string().describe('The ID of the target node.'),
  sourceHandle: z.string().optional().describe('The specific output handle on the source node (e.g., "output-main", "output-yes").'),
});

const GenerateCrmAutomationOutputSchema = z.object({
  nodes: z.array(CrmAutomationNodeSchema).describe('An array of all nodes in the automation.'),
  edges: z.array(CrmAutomationEdgeSchema).describe('An array of all edges connecting the nodes.'),
});

const GenerateCrmAutomationInputSchema = z.object({
  prompt: z.string().describe("The user's description of the automation they want to create."),
});

export async function generateCrmAutomation(input: z.infer<typeof GenerateCrmAutomationInputSchema>): Promise<z.infer<typeof GenerateCrmAutomationOutputSchema>> {
  return generateCrmAutomationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCrmAutomationPrompt',
  input: { schema: GenerateCrmAutomationInputSchema },
  output: { schema: GenerateCrmAutomationOutputSchema },
  prompt: `You are an expert at creating CRM automation workflows. Your task is to generate a valid JSON object containing 'nodes' and 'edges' arrays based on a user's prompt.

RULES:
1.  **Start Node**: Every automation MUST begin with one 'triggerTagAdded' node. This is the only valid trigger type.
2.  **Layout**: Position nodes from top to bottom. Increment the 'y' position for each step in the flow (e.g., by 150-200). Use the 'x' position to separate branches for conditions.
3.  **Connectivity**: Ensure every node (except the end of a branch) is connected via an edge. All non-trigger nodes must have an incoming connection.
4.  **Node IDs**: Generate unique and descriptive node IDs (e.g., "node-start", "node-send-welcome", "edge-start-to-welcome").
5.  **Handles**:
    - Standard nodes have one output handle: "output-main".
    - 'condition' nodes have two output handles: "output-yes" and "output-no".
    - All non-trigger nodes have one input handle: "input".
6.  **Available Node Types**: Use only the following node types: 'triggerTagAdded', 'actionSendEmail', 'actionCreateTask', 'actionAddTag', 'delay', 'condition'.
7.  **Data Extraction**: Extract relevant data from the prompt. For a 'delay' node, determine the 'delayValue' and 'delayUnit'. For a 'condition', determine the 'variable', 'operator', and 'value'.

USER PROMPT:
"{{{prompt}}}"

Generate the JSON now.`,
});

const generateCrmAutomationFlow = ai.defineFlow(
  {
    name: 'generateCrmAutomationFlow',
    inputSchema: GenerateCrmAutomationInputSchema,
    outputSchema: GenerateCrmAutomationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
