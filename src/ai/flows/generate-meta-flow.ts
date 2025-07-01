
'use server';
/**
 * @fileOverview Generates a complete, multi-screen Meta Flow JSON structure based on a user's prompt.
 *
 * This file defines the `generateMetaFlow` function, which takes a user's prompt
 * and a category to generate a valid Meta Flow JSON object using the declarative layout structure (v7.1).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Base Schemas ---

const ActionSchema = z.object({
  name: z.enum(['navigate', 'complete', 'data_exchange', 'open_url']).describe("Action type."),
  next: z.object({ type: z.literal('screen'), name: z.string() }).optional().describe("For 'navigate', the ID of the next screen."),
  payload: z.record(z.any()).optional().describe("Data to be submitted or passed. Use variables like ${form.input_name} or ${data.variable_name}."),
});

// --- Component Schemas (Recursive setup) ---

// Use z.ZodType to allow for recursive schema definitions.
const FormComponentSchema: z.ZodType<any> = z.lazy(() => z.union([
    z.object({ type: z.literal('TextHeading'), text: z.string(), visible: z.boolean().optional() }),
    z.object({ type: z.literal('TextSubheading'), text: z.string(), visible: z.boolean().optional() }),
    z.object({ type: z.literal('TextBody'), text: z.string(), visible: z.boolean().optional() }),
    z.object({ type: z.literal('TextCaption'), text: z.string(), visible: z.boolean().optional() }),
    z.object({ type: z.literal('TextInput'), name: z.string(), label: z.string(), "helper-text": z.string().optional(), required: z.boolean().optional(), "input-type": z.enum(['text', 'email', 'password']).optional(), "max-length": z.number().optional() }),
    z.object({ type: z.literal('TextArea'), name: z.string(), label: z.string(), "helper-text": z.string().optional(), required: z.boolean().optional(), "max-length": z.number().optional() }),
    z.object({ type: z.literal('Dropdown'), name: z.string(), label: z.string(), "data-source": z.array(z.object({ id: z.string(), title: z.string() })), required: z.boolean().optional(), "on-select-action": ActionSchema.optional() }),
    z.object({ type: z.literal('RadioButtonsGroup'), name: z.string(), label: z.string(), "data-source": z.array(z.object({ id: z.string(), title: z.string() })), required: z.boolean().optional() }),
    z.object({ type: z.literal('CheckboxGroup'), name: z.string(), label: z.string(), "data-source": z.array(z.object({ id: z.string(), title: z.string() })), required: z.boolean().optional() }),
    z.object({ type: z.literal('DatePicker'), name: z.string(), label: z.string(), "min-date": z.string().optional(), "max-date": z.string().optional(), required: z.boolean().optional(), "on-select-action": ActionSchema.optional() }),
    z.object({ type: z.literal('Footer'), label: z.string(), "on-click-action": ActionSchema }),
    z.object({ type: z.literal('EmbeddedLink'), text: z.string(), "on-click-action": ActionSchema, visible: z.boolean().optional() }),
    z.object({ type: z.literal('PhotoPicker'), name: z.string(), label: z.string(), required: z.boolean().optional(), "min-uploaded-photos": z.number().optional(), "max-uploaded-photos": z.number().optional() }),
    z.object({ type: z.literal('DocumentPicker'), name: z.string(), label: z.string(), required: z.boolean().optional(), "min-uploaded-documents": z.number().optional(), "max-uploaded-documents": z.number().optional() }),
    z.object({ type: z.literal('CalendarPicker'), name: z.string(), label: z.union([z.string(), z.object({ "start-date": z.string(), "end-date": z.string() })]), mode: z.enum(['single', 'range']), "on-select-action": ActionSchema.optional() }),
    z.object({ type: z.literal('ChipsSelector'), name: z.string(), label: z.string(), "data-source": z.array(z.object({ id: z.string(), title: z.string() })), "max-selected-items": z.number().optional(), "min-selected-items": z.number().optional() }),
    z.object({ type: z.literal('ImageCarousel'), name: z.string(), images: z.array(z.object({ "alt-text": z.string(), src: z.string() })) }),
    z.object({ type: z.literal('OptIn'), name: z.string(), label: z.string(), required: z.boolean().optional() }),
    z.object({ type: z.literal('Image'), src: z.string(), "alt-text": z.string(), visible: z.boolean().optional() }),
    // Conditional components
    z.object({ type: z.literal('If'), condition: z.string().describe("A boolean expression, e.g., '${data.show_section}' or '${form.age} > 18'"), then: z.array(FormComponentSchema), else: z.array(FormComponentSchema).optional() }),
    z.object({ type: z.literal('Switch'), value: z.string().describe("The variable to switch on, e.g., '${form.choice}'"), cases: z.record(z.array(FormComponentSchema)).describe("A map where keys are possible values and values are arrays of components to render.") })
]));

// --- Layout Schemas ---

const FormSchema = z.object({
  type: z.literal('Form'),
  name: z.string().describe("A unique name for the form, e.g., 'user_details_form'."),
  children: z.array(FormComponentSchema),
});

const NavigationListItemSchema = z.object({
  id: z.string(),
  "main-content": z.object({ title: z.string(), description: z.string().optional() }),
  "on-click-action": ActionSchema.optional(),
});

const NavigationListSchema = z.object({
  type: z.literal('NavigationList'),
  name: z.string(),
  label: z.string(),
  "list-items": z.union([z.string().describe("A dynamic variable like '${data.insurances}'"), z.array(NavigationListItemSchema)]),
  "on-click-action": ActionSchema.optional(),
});

const ScreenLayoutChildSchema = z.union([FormSchema, NavigationListSchema]);

const ScreenSchema = z.object({
  id: z.string().describe("A unique identifier for the screen, e.g., 'SURVEY_START'."),
  title: z.string().describe("The title of the screen."),
  layout: z.object({
      type: z.literal('SingleColumnLayout'),
      children: z.array(ScreenLayoutChildSchema).describe("The main layout components. Usually contains a single 'Form' or 'NavigationList'."),
  }),
  terminal: z.boolean().optional().describe("If true, this is a final screen in the flow."),
  success: z.boolean().optional().describe("Used with terminal screens to indicate success state."),
  data: z.record(z.any()).optional().describe("Defines the data model for dynamic content, e.g., {'available_slots': { 'type': 'array', 'items': {'type':'string'} } }."),
});

// --- Main Flow Schema ---

const FlowJSONSchema = z.object({
  version: z.literal("7.1"),
  data_api_version: z.literal("3.0").optional(),
  name: z.string().describe("The name of the flow."),
  description: z.string().optional().describe("A brief description of the flow."),
  routing_model: z.record(z.array(z.string())).describe("Defines the navigation paths between screens, e.g., {'SCREEN_1': ['SCREEN_2', 'FINAL_SCREEN']}."),
  screens: z.array(ScreenSchema).describe("An array of all screens that make up the flow. MUST contain at least one screen."),
});

const GenerateMetaFlowOutputSchema = FlowJSONSchema;

const GenerateMetaFlowInputSchema = z.object({
  prompt: z.string().describe("The user's description of the flow they want to create."),
  category: z.string().describe("The category of the flow, which helps give context to the AI."),
});

export async function generateMetaFlow(input: z.infer<typeof GenerateMetaFlowInputSchema>): Promise<z.infer<typeof GenerateMetaFlowOutputSchema>> {
  return generateMetaFlowFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMetaFlowPrompt_v7.1_declarative',
  input: { schema: GenerateMetaFlowInputSchema },
  output: { schema: GenerateMetaFlowOutputSchema },
  prompt: `You are an expert in creating interactive WhatsApp Flows using Meta's latest **declarative** Flow JSON format (v7.1). Your task is to generate a complete, multi-screen Flow JSON object based on the user's request.

The output must strictly adhere to the provided JSON schema.

RULES:
1.  **Top-Level Structure**: The root must contain 'version', 'name', 'routing_model', and 'screens'.
2.  **Screen Structure**: Each screen has an 'id', 'title', and a 'layout'. The layout must be a 'SingleColumnLayout' containing a 'children' array. This array usually contains a single 'Form' or a single 'NavigationList'.
3.  **Form Structure**: A 'Form' component contains a 'children' array where all the inputs, text, and the final 'Footer' go.
4.  **Navigation Model**:
    -   The 'routing_model' at the root of the JSON defines all possible paths. For each screen ID, list the IDs of all screens it can navigate to. E.g., {'SCREEN_1': ['SCREEN_2'], 'SCREEN_2': ['FINAL_SCREEN']}.
    -   Inside a screen, navigation is triggered by a 'Footer' component's 'on-click-action' or a 'NavigationList' item's action.
    -   Use: 'on-click-action': { 'name': 'navigate', 'next': { 'type': 'screen', 'name': 'TARGET_SCREEN_ID' } }.
    -   The FINAL screen in a path must have its 'terminal' property set to true and its footer action must be 'name': 'complete'.
5.  **Data Handling**:
    -   To pass data between screens, use a 'payload' in the navigation action. E.g., 'payload': {'user_name': '\${form.name_input}'}.
    -   The receiving screen must define this data in its 'data' property. E.g., 'data': {'user_name': { 'type': 'string' } }.
    -   Use '\${form.component_name}' to access user input from the current screen.
    -   Use '\${data.variable_name}' to access data passed from a previous screen.
6.  **Component Variety**: Use a variety of the available components based on the user's prompt (e.g., TextInput, DatePicker, Dropdown, RadioButtonsGroup).
7.  **Full Experience**: Create at least 2-3 screens for an interactive flow (e.g., a welcome screen, one or more data collection screens, and a final thank you/confirmation screen).

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
    const flow_json = {
        name: output?.name || 'ai_generated_flow',
        ...output
    };
    return flow_json;
  }
);
