
'use server';
/**
 * @fileOverview Generates a complete, multi-screen Meta Flow JSON structure based on a user's prompt.
 *
 * This file defines the `generateMetaFlow` function, which takes a user's prompt
 * and a category to generate a valid Meta Flow JSON object using the declarative layout structure.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Zod Schemas for Meta Flow JSON Structure (Declarative Layout Style) ---

const ActionSchema = z.object({
  name: z.enum(['navigate', 'complete', 'data_exchange', 'open_url']).describe("Action type."),
  next: z.object({ type: z.literal('screen'), name: z.string() }).optional().describe("For 'navigate', the ID of the next screen."),
  payload: z.record(z.any()).optional().describe("Data to be submitted or passed. Use variables like ${form.input_name} or ${data.variable_name}."),
});

// --- Component Schemas ---
const TextInputSchema = z.object({ type: z.literal('TextInput'), id: z.string(), label: z.string(), placeholder: z.string().optional(), required: z.boolean().optional() });
const NumberInputSchema = z.object({ type: z.literal('NumberInput'), id: z.string(), label: z.string(), placeholder: z.string().optional(), min: z.number().optional(), max: z.number().optional(), required: z.boolean().optional() });
const UrlInputSchema = z.object({ type: z.literal('UrlInput'), id: z.string(), label: z.string(), placeholder: z.string().optional(), required: z.boolean().optional() });
const TimePickerSchema = z.object({ type: z.literal('TimePicker'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const ButtonSchema = z.object({ type: z.literal('Button'), id: z.string(), label: z.string(), action: ActionSchema });
const PhotoPickerSchema = z.object({ type: z.literal('PhotoPicker'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const DocumentPickerSchema = z.object({ type: z.literal('DocumentPicker'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const CalendarSchema = z.object({ type: z.literal('Calendar'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const ContactPickerSchema = z.object({ type: z.literal('ContactPicker'), id: z.string(), label: z.string(), required: z.boolean().optional() });
const OptionSchema = z.object({ id: z.string(), label: z.string() });
const ChipsSelectorSchema = z.object({ type: z.literal('ChipsSelector'), id: z.string(), label: z.string(), options: z.array(OptionSchema), multi_select: z.boolean().optional(), required: z.boolean().optional() });
const RadioSelectorSchema = z.object({ type: z.literal('RadioSelector'), id: z.string(), label: z.string(), options: z.array(OptionSchema), required: z.boolean().optional() });
const ListSelectorSchema = z.object({ type: z.literal('ListSelector'), id: z.string(), label: z.string(), options: z.array(OptionSchema), required: z.boolean().optional() });

const FlowComponentSchema = z.union([
    TextInputSchema, NumberInputSchema, UrlInputSchema, TimePickerSchema, ButtonSchema,
    PhotoPickerSchema, DocumentPickerSchema, CalendarSchema, ContactPickerSchema,
    ChipsSelectorSchema, RadioSelectorSchema, ListSelectorSchema
]);

const ScreenSchema = z.object({
  id: z.string().describe("A unique identifier for the screen, e.g., 'SURVEY_START'."),
  title: z.object({ text: z.string(), markdown: z.boolean().optional() }).describe("The title of the screen."),
  body: z.object({ text: z.string(), markdown: z.boolean().optional() }).describe("The body text for the screen."),
  components: z.array(FlowComponentSchema).describe('An array of UI components for the screen.'),
});

const FlowSchema = z.object({
    name: z.string().describe("The name of the flow."),
    description: z.string().optional().describe("A brief description of the flow."),
    screens: z.array(ScreenSchema).describe("An array of all screens that make up the flow. MUST contain at least one screen."),
    metadata: z.object({
        language: z.string().describe("Flow language code, e.g., 'en_US'."),
        theme: z.enum(['light', 'dark']).optional().describe("The visual theme of the flow."),
    })
});

const GenerateMetaFlowOutputSchema = z.object({
  version: z.string().describe("The WhatsApp Flow JSON version. Use '7.1'."),
  flow: FlowSchema.describe("The main flow object containing screens and metadata."),
});

const GenerateMetaFlowInputSchema = z.object({
  prompt: z.string().describe("The user's description of the flow they want to create."),
  category: z.string().describe("The category of the flow, which helps give context to the AI."),
});

export async function generateMetaFlow(input: z.infer<typeof GenerateMetaFlowInputSchema>): Promise<z.infer<typeof GenerateMetaFlowOutputSchema>> {
  return generateMetaFlowFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMetaFlowPrompt_v7_declarative',
  input: { schema: GenerateMetaFlowInputSchema },
  output: { schema: GenerateMetaFlowOutputSchema },
  prompt: `You are an expert in creating interactive WhatsApp Flows using Meta's latest **declarative** Flow JSON format (v7.1). Your task is to generate a complete, multi-screen Flow JSON object based on the user's request.

The output must strictly adhere to the provided JSON schema.

RULES:
1.  **Structure**: The root must contain 'version' and 'flow'. The 'flow' object contains 'name', 'screens', and 'metadata'. Each screen has 'id', 'title', 'body', and an array of 'components'.
2.  **Navigation**: Every screen MUST have a \`Button\` component with an action to navigate or submit.
    - To go to the next screen, use: \`"action": { "type": "navigate", "target": "screen_id_of_next_screen" }\`.
    - The FINAL screen's button MUST use: \`"action": { "type": "submit" }\`.
3.  **Unique IDs**: All 'screen' IDs and component 'id' properties must be unique strings (e.g., "screen_1", "text_input_name").
4.  **Component Variety**: Use a variety of the available components based on the user's prompt: \`TextInput\`, \`NumberInput\`, \`UrlInput\`, \`TimePicker\`, \`Button\`, \`PhotoPicker\`, \`DocumentPicker\`, \`Calendar\`, \`ContactPicker\`, \`ChipsSelector\`, \`RadioSelector\`, \`ListSelector\`.
5.  **Create a Full Experience**: Create at least 2-3 screens for an interactive flow (e.g., a welcome screen, one or more data collection screens, and a final thank you/confirmation screen).

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

    