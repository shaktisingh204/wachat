
'use server';
/**
 * @fileOverview Generates a complete, multi-screen Meta Flow JSON structure based on a user's prompt.
 *
 * This file defines the `generateMetaFlow` function, which takes a user's prompt
 * and a category to generate a valid Meta Flow JSON object.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Zod Schemas for Meta Flow JSON Structure v7.1 ---

const FlowMetadataSchema = z.object({
  language: z.string().describe("The BCP 47 language code for the flow, e.g., 'en_US'."),
  theme: z.enum(['light', 'dark']).optional().describe("The color theme for the flow."),
});

const ScreenTextSchema = z.object({
  text: z.string().describe("The text content."),
  markdown: z.boolean().optional().describe("Whether the text supports markdown. Default to true."),
});

const ActionSchema = z.object({
  type: z.enum(['navigate', 'submit']).describe("The action to perform when the button is clicked."),
  target: z.string().optional().describe("The ID of the next screen to navigate to. Required if type is 'navigate'."),
});

const ButtonComponentSchema = z.object({
    type: z.literal('Button'),
    id: z.string().describe("A unique identifier for this component."),
    label: z.string().describe("The text displayed on the button."),
    action: ActionSchema,
});

const TextInputComponentSchema = z.object({ type: z.literal('TextInput'), id: z.string(), label: z.string(), placeholder: z.string().optional(), required: z.boolean().optional() });
const NumberInputComponentSchema = z.object({ type: z.literal('NumberInput'), id: z.string(), label: z.string(), placeholder: z.string().optional(), min: z.number().optional(), max: z.number().optional(), required: z.boolean().optional() });
const UrlInputComponentSchema = z.object({ type: z.literal('UrlInput'), id: z.string(), label: z.string(), placeholder: z.string().optional(), required: z.boolean().optional() });
const TimePickerComponentSchema = z.object({ type: z.literal('TimePicker'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const PhotoPickerComponentSchema = z.object({ type: z.literal('PhotoPicker'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const DocumentPickerComponentSchema = z.object({ type: z.literal('DocumentPicker'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const CalendarComponentSchema = z.object({ type: z.literal('Calendar'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const ContactPickerComponentSchema = z.object({ type: z.literal('ContactPicker'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const ChipsSelectorComponentSchema = z.object({ type: z.literal('ChipsSelector'), id: z.string(), label: z.string(), options: z.array(z.object({ id: z.string(), label: z.string() })), multi_select: z.boolean().optional(), required: z.boolean().optional() });
const RadioSelectorComponentSchema = z.object({ type: z.literal('RadioSelector'), id: z.string(), label: z.string(), options: z.array(z.object({ id: z.string(), label: z.string() })), required: z.boolean().optional() });
const ListSelectorComponentSchema = z.object({ type: z.literal('ListSelector'), id: z.string(), label: z.string(), options: z.array(z.object({ id: z.string(), label: z.string() })), required: z.boolean().optional() });

const FlowComponentSchema = z.union([
    TextInputComponentSchema,
    NumberInputComponentSchema,
    UrlInputComponentSchema,
    TimePickerComponentSchema,
    PhotoPickerComponentSchema,
    DocumentPickerComponentSchema,
    CalendarComponentSchema,
    ContactPickerComponentSchema,
    ChipsSelectorComponentSchema,
    RadioSelectorComponentSchema,
    ListSelectorComponentSchema,
    ButtonComponentSchema,
]);

const ScreenSchema = z.object({
  id: z.string().describe("A unique identifier for the screen, e.g., 'screen_1'."),
  title: ScreenTextSchema.describe("The title of the screen."),
  body: ScreenTextSchema.optional().describe("The body text of the screen."),
  components: z.array(FlowComponentSchema).describe("An array of UI components for this screen."),
});

const FlowObjectSchema = z.object({
  name: z.string().describe("The name of the flow."),
  description: z.string().optional().describe("A brief description of the flow's purpose."),
  screens: z.array(ScreenSchema).describe("An array of screens that make up the flow. MUST contain at least one screen."),
  metadata: FlowMetadataSchema.describe("Metadata for the flow."),
});

const GenerateMetaFlowOutputSchema = z.object({
  version: z.string().describe("The WhatsApp Flow JSON version. Use a supported version like '7.1'."),
  flow: FlowObjectSchema,
});


const GenerateMetaFlowInputSchema = z.object({
  prompt: z.string().describe("The user's description of the flow they want to create."),
  category: z.string().describe("The category of the flow, which helps give context to the AI."),
});

export async function generateMetaFlow(input: z.infer<typeof GenerateMetaFlowInputSchema>): Promise<z.infer<typeof GenerateMetaFlowOutputSchema>> {
  return generateMetaFlowFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generateMetaFlowPrompt_v7',
  input: { schema: GenerateMetaFlowInputSchema },
  output: { schema: GenerateMetaFlowOutputSchema },
  prompt: `You are an expert in creating interactive WhatsApp Flows using Meta's latest Flow JSON format (v7.1). Your task is to generate a complete, multi-screen Flow JSON object based on the user's request.

The output must strictly adhere to the provided JSON schema.

RULES:
1.  **Navigation is Key**: Every screen MUST have a 'Button' component with an action.
    - To go to the next screen, use: '"action": { "type": "navigate", "target": "screen_id_of_next_screen" }'.
    - The FINAL screen's button MUST use: '"action": { "type": "submit" }'.
2.  **Unique IDs**: All 'screen' and 'component' IDs must be unique strings (e.g., "screen_1", "text_input_name").
3.  **Create a Full Experience**: Create at least 2-3 screens for an interactive flow (e.g., a welcome screen, one or more data collection screens, and a final thank you/confirmation screen).
4.  **Component Variety**: Use a variety of the new components available to create a rich user experience: 'TextInput', 'NumberInput', 'UrlInput', 'TimePicker', 'PhotoPicker', 'DocumentPicker', 'Calendar', 'ContactPicker', 'ChipsSelector', 'RadioSelector', 'ListSelector', and 'Button'.
5.  **Required Fields**: For all input components, set 'required: true' if the user's prompt implies the information is necessary.

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
