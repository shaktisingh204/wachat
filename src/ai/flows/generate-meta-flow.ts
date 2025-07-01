
'use server';
/**
 * @fileOverview Generates a complete, multi-screen Meta Flow JSON structure based on a user's prompt.
 *
 * - generateMetaFlow - The main function that orchestrates the AI generation.
 * - GenerateMetaFlowInput - The input type for the AI flow.
 * - GenerateMetaFlowOutput - The return type, representing the full Flow JSON.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Zod Schemas for Meta Flow JSON Structure ---

const UIComponentSchema = z.object({
    type: z.enum(['TextHeading', 'TextBody', 'TextSubtext', 'Image', 'TextInput', 'DatePicker', 'RadioButtons', 'CheckboxGroup', 'Dropdown', 'OptIn']),
    name: z.string().optional().describe("A unique identifier for form components like TextInput, DatePicker, etc. This is crucial for data collection."),
    label: z.string().optional().describe("The user-visible label for a form field."),
    text: z.string().optional().describe("The text content for components like TextHeading, TextBody."),
    url: z.string().url().optional().describe("URL for the Image component."),
    caption: z.string().optional().describe("Optional caption for an Image."),
    'input-type': z.enum(['text', 'number', 'email']).optional(),
    'data-source': z.array(z.object({ id: z.string(), title: z.string() })).optional().describe("Options for RadioButtons, CheckboxGroup, or Dropdown."),
}).passthrough();

const FooterSchema = z.object({
    type: z.literal('Footer'),
    label: z.string().describe("The text for the main action button on the screen."),
    'on-click-action': z.object({
        name: z.enum(['navigate', 'complete']),
        payload: z.object({
            next: z.string().optional().describe("The ID of the next screen to navigate to. Required if name is 'navigate'.")
        }).optional()
    })
});

const LayoutSchema = z.object({
    type: z.literal('SingleColumnLayout'),
    children: z.array(z.union([UIComponentSchema, FooterSchema]))
});

const ScreenSchema = z.object({
    id: z.string().describe("A unique identifier for the screen, e.g., 'SCREEN_1'."),
    title: z.string().describe("The title of the screen, displayed in the header."),
    layout: LayoutSchema
});

const GenerateMetaFlowOutputSchema = z.object({
    version: z.literal("3.0"),
    screens: z.array(ScreenSchema).describe("An array of screens that make up the flow. Should contain at least a welcome screen and a confirmation/thank you screen.")
});
export type GenerateMetaFlowOutput = z.infer<typeof GenerateMetaFlowOutputSchema>;


const GenerateMetaFlowInputSchema = z.object({
  prompt: z.string().describe("The user's description of the flow they want to create."),
  category: z.string().describe("The category of the flow, which helps give context to the AI."),
});
export type GenerateMetaFlowInput = z.infer<typeof GenerateMetaFlowInputSchema>;


export async function generateMetaFlow(input: GenerateMetaFlowInput): Promise<GenerateMetaFlowOutput> {
  return generateMetaFlowFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generateMetaFlowPrompt',
  input: { schema: GenerateMetaFlowInputSchema },
  output: { schema: GenerateMetaFlowOutputSchema },
  prompt: `You are an expert in creating interactive WhatsApp Flows using Meta's Flow JSON format. Your task is to generate a complete, multi-screen Flow JSON object based on the user's request and the selected category.

The output must strictly adhere to the provided JSON schema.

Here are the available UI components you can use in the 'children' array of a screen's layout: 'TextHeading', 'TextBody', 'TextSubtext', 'Image', 'TextInput', 'DatePicker', 'RadioButtons', 'CheckboxGroup', 'Dropdown', 'OptIn'. Be creative and use a variety of components to create a good user experience.

RULES:
1.  For all interactive components like 'TextInput', 'RadioButtons', etc., you MUST provide a unique 'name' property (e.g., "user_name", "lead_email"). This is crucial for data collection.
2.  Every screen MUST have a 'Footer' component. The footer's 'on-click-action' should be \`{'name': 'navigate', 'payload': {'next': 'SCREEN_ID_OF_NEXT_SCREEN'}}\` to go to the next screen, or \`{'name': 'complete'}\` for the final screen's button.
3.  Create at least 2-3 screens to make the flow interactive. For example, a welcome screen, one or more data collection screens, and a final thank you/confirmation screen.
4.  Screen IDs must be unique and follow the convention 'SCREEN_1', 'SCREEN_2', etc.
5.  Generate placeholder URLs for images, like 'https://placehold.co/600x400.png'.

User Request: "{{{prompt}}}"
Flow Category: "{{{category}}}"

Generate the Flow JSON now.`,
});

const generateMetaFlowFlow = ai.defineFlow(
  {
    name: 'generateMetaFlowFlow',
    inputSchema: GenerateMetaFlowInputSchema,
    outputSchema: GenerateMetaFlowOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
