
'use server';
/**
 * @fileOverview Generates a complete, multi-screen Meta Flow JSON structure based on a user's prompt.
 *
 * This file defines the `generateMetaFlow` function, which takes a user's prompt
 * and a category to generate a valid Meta Flow JSON object using the nested layout structure.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Zod Schemas for Meta Flow JSON Structure (Layout v3 style) ---

const OnClickActionSchema = z.object({
  name: z.enum(['navigate', 'complete']).describe("The action to perform. Use 'navigate' to go to another screen, or 'complete' to finish the flow."),
  next: z.object({
    type: z.literal('screen'),
    name: z.string().describe("The ID of the screen to navigate to."),
  }).optional().describe("The next screen to navigate to. Required if action name is 'navigate'."),
  payload: z.record(z.any()).optional().describe("Data to be submitted or passed to the next screen. Use variables like ${form.input_name}."),
});

const FooterComponentSchema = z.object({
  type: z.literal('Footer'),
  label: z.string().describe("The text on the button."),
  'on-click-action': OnClickActionSchema,
});

const DataSourceSchema = z.object({
    id: z.string(),
    title: z.string(),
});

const TextSubheadingSchema = z.object({
    type: z.literal('TextSubheading'),
    text: z.string(),
});

const TextAreaSchema = z.object({
    type: z.literal('TextArea'),
    label: z.string(),
    name: z.string().describe("Unique name for this form field."),
    required: z.boolean().optional(),
});

const DropdownSchema = z.object({
    type: z.literal('Dropdown'),
    label: z.string(),
    name: z.string().describe("Unique name for this form field."),
    required: z.boolean().optional(),
    'data-source': z.array(DataSourceSchema),
});

const RadioButtonsGroupSchema = z.object({
    type: z.literal('RadioButtonsGroup'),
    label: z.string(),
    name: z.string().describe("Unique name for this form field."),
    'data-source': z.array(DataSourceSchema),
    required: z.boolean().optional(),
});

const CheckboxGroupSchema = z.object({
    type: z.literal('CheckboxGroup'),
    label: z.string(),
    name: z.string().describe("Unique name for this form field."),
    'data-source': z.array(DataSourceSchema),
    required: z.boolean().optional(),
});

const OptInSchema = z.object({
    type: z.literal('OptIn'),
    label: z.string(),
    name: z.string().describe("Unique name for this form field."),
    required: z.boolean().optional(),
});

const FormComponentSchema = z.union([
    TextSubheadingSchema,
    TextAreaSchema,
    DropdownSchema,
    RadioButtonsGroupSchema,
    CheckboxGroupSchema,
    OptInSchema,
    FooterComponentSchema,
]);

const FormContainerSchema = z.object({
  type: z.literal('Form'),
  name: z.string().describe("The name of the form, e.g., 'main_form'"),
  children: z.array(FormComponentSchema),
});

const LayoutSchema = z.object({
  type: z.literal('SingleColumnLayout'),
  children: z.array(FormContainerSchema),
});

const ScreenSchema = z.object({
  id: z.string().describe("A unique identifier for the screen, e.g., 'SURVEY_START'."),
  title: z.string().describe("The title of the screen."),
  data: z.record(z.any()).optional().describe("Defines variables passed from the previous screen."),
  terminal: z.boolean().optional().describe("Set to true if this is a final screen in the flow."),
  success: z.boolean().optional().describe("Indicates if this is a success screen, often used with terminal:true."),
  layout: LayoutSchema,
});

const GenerateMetaFlowOutputSchema = z.object({
  version: z.string().describe("The WhatsApp Flow JSON version. Use '7.1'."),
  screens: z.array(ScreenSchema).describe("An array of all screens that make up the flow. MUST contain at least one screen."),
});

const GenerateMetaFlowInputSchema = z.object({
  prompt: z.string().describe("The user's description of the flow they want to create."),
  category: z.string().describe("The category of the flow, which helps give context to the AI."),
});

export async function generateMetaFlow(input: z.infer<typeof GenerateMetaFlowInputSchema>): Promise<z.infer<typeof GenerateMetaFlowOutputSchema>> {
  return generateMetaFlowFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generateMetaFlowPrompt_v7_layout',
  input: { schema: GenerateMetaFlowInputSchema },
  output: { schema: GenerateMetaFlowOutputSchema },
  prompt: `You are an expert in creating interactive WhatsApp Flows using Meta's latest Flow JSON format (v7.1). Your task is to generate a complete, multi-screen Flow JSON object based on the user's request.

The output must strictly adhere to the provided JSON schema, which uses a nested layout structure.

RULES:
1.  **Structure**: Every screen must have a 'SingleColumnLayout' containing one 'Form'. The form's 'children' array holds all UI components.
2.  **Navigation is Key**: Every form MUST have a 'Footer' component which acts as the main button for the screen.
    - To go to the next screen, the footer's action is: \`"on-click-action": { "name": "navigate", "next": { "type": "screen", "name": "next_screen_id" } }\`.
    - The FINAL screen's footer MUST use: \`"on-click-action": { "name": "complete" }\`.
3.  **Data Passing**: To pass data to the next screen, add a 'payload' object to the footer's 'on-click-action'. Use variables like \`"\${form.input_name}"\`. The next screen must define these variables in its 'data' property.
4.  **Unique IDs**: All 'screen' IDs and component 'name' properties within a form must be unique strings (e.g., "screen_1", "user_name").
5.  **Component Variety**: Use a variety of the available components: 'TextSubheading', 'TextArea', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'OptIn', and 'Footer'.
6.  **Create a Full Experience**: Create at least 2-3 screens for an interactive flow (e.g., a welcome screen, one or more data collection screens, and a final thank you/confirmation screen).

User Request: "{{{prompt}}}"
Flow Category: "{{{category}}}"

Generate the full Flow JSON now.`,
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
