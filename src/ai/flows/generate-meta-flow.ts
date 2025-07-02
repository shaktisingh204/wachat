
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
  url: z.string().optional().describe("For 'open_url', the URL to open."),
});

// --- Component Schemas (Recursive setup) ---

// Use z.ZodType to allow for recursive schema definitions.
const FormComponentSchema: z.ZodType<any> = z.lazy(() => z.union([
    z.object({ type: z.literal('TextHeading'), text: z.string(), visible: z.boolean().optional() }),
    z.object({ type: z.literal('TextSubheading'), text: z.string(), visible: z.boolean().optional() }),
    z.object({ type: z.literal('TextBody'), text: z.string(), visible: z.boolean().optional() }),
    z.object({ type: z.literal('TextCaption'), text: z.string(), visible: z.boolean().optional() }),
    z.object({ type: z.literal('TextInput'), name: z.string(), label: z.string(), "helper-text": z.string().optional(), required: z.boolean().optional(), "input-type": z.enum(['text', 'email', 'password', 'phone', 'number']).optional(), "max-length": z.number().optional() }),
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
    z.object({ type: z.literal('ImageCarousel'), name: z.string(), images: z.array(z.object({ "alt-text": z.string(), src: z.string().describe("Use the placeholder 'base64_image_placeholder' for images.") })) }),
    z.object({ type: z.literal('OptIn'), name: z.string(), label: z.string(), required: z.boolean().optional() }),
    z.object({ type: z.literal('Image'), src: z.string().describe("Use the placeholder 'base64_image_placeholder' for images."), "alt-text": z.string(), visible: z.boolean().optional() }),
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

const ScreenLayoutChildSchema = z.union([
    FormSchema, 
    NavigationListSchema,
    z.object({ type: z.literal('TextHeading'), text: z.string() }),
    z.object({ type: z.literal('TextBody'), text: z.string() }),
    z.object({ type: z.literal('ImageCarousel'), name: z.string(), images: z.array(z.object({ "alt-text": z.string(), src: z.string().describe("Use the placeholder 'base64_image_placeholder' for images.") })) }),
]);

const DataDefinitionSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  __example__: z.any().optional().describe("An example value for the data, e.g., 'John Doe' or ['Option 1', 'Option 2']."),
  items: z.any().optional().describe("For 'array' type, a schema for the items in the array."),
  properties: z.record(z.any()).optional().describe("For 'object' type, a schema for the object properties."),
});


const ScreenSchema = z.object({
  id: z.string().regex(/^[A-Z_0-9]+$/, "Screen ID must be uppercase letters, numbers, and underscores only.").describe("A unique identifier for the screen, e.g., 'SURVEY_START'. Must be uppercase letters, numbers, and underscores only."),
  title: z.string().describe("The title of the screen."),
  layout: z.object({
      type: z.literal('SingleColumnLayout'),
      children: z.array(ScreenLayoutChildSchema).describe("The main layout components. Usually contains a single 'Form' or 'NavigationList'."),
  }),
  terminal: z.boolean().optional().describe("If true, this is a final screen in the flow."),
  success: z.boolean().optional().describe("Used with terminal screens to indicate success state."),
  data: z.record(DataDefinitionSchema).optional().describe("Defines the data model for dynamic content. Use `__example__` to provide sample data."),
});

// --- Main Flow Schema ---

const FlowJSONSchema = z.object({
  version: z.literal("7.1"),
  data_api_version: z.literal("3.0").optional(),
  name: z.string().describe("A descriptive name for the flow, e.g., 'appointment_booking' or 'lead_gen_v2'."),
  description: z.string().optional().describe("A brief, user-friendly description of what the flow does."),
  routing_model: z.record(z.array(z.string())).describe("Defines the navigation paths between screens, e.g., {'SCREENA': ['SCREENB', 'FINALSCREEN']}."),
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

**CRITICAL RULES:**
1.  **Strict Schema Adherence**: Only include properties explicitly defined in the schema for each component. DO NOT add extraneous properties. For example:
    -   \`TextHeading\`, \`TextSubheading\`, \`TextBody\`, and \`TextCaption\` components ONLY have a \`text\` and optional \`visible\` property. DO NOT add a \`name\` property to them.
    -   Input components like \`TextInput\` and \`Dropdown\` MUST have a \`name\` property.
2.  **Top-Level Structure**: The root object MUST contain 'version', 'name', 'routing_model', and 'screens'.
3.  **Name and Description**: Generate a descriptive 'name' (e.g., 'appointment_booking', 'lead_gen_v2') and a helpful 'description' for the flow based on the user's request.
4.  **Screen Structure**: Each screen in the 'screens' array requires:
    -   \`id\`: An ID with only uppercase letters, numbers, and underscores (e.g., 'WELCOME_SCREEN', 'SURVEY_PAGE_1').
    -   \`title\`: A string for the screen title.
    -   \`layout\`: A 'SingleColumnLayout' object containing a 'children' array. This array usually holds a single 'Form' or a 'NavigationList'.
5.  **Navigation Model**:
    -   The \`routing_model\` defines all possible navigation paths. For each screen ID, list the IDs of all screens it can navigate to. Example: \`{'SCREEN_A': ['SCREEN_B'], 'SCREEN_B': ['FINAL_SCREEN'], 'FINAL_SCREEN': []}\`.
    -   Navigation is triggered by \`on-click-action\` (on \`Footer\`, \`EmbeddedLink\`, or \`NavigationList\` items).
    -   Use the format: \`{ "name": "navigate", "next": { "type": "screen", "name": "TARGET_ID" } }\`.
6.  **Final Screens**: The final screen in any path must have \`terminal: true\`. Its footer action must be \`{ "name": "complete" }\`.
7.  **Data Handling**:
    -   To pass data, use a \`payload\` in the navigation action: \`payload: { "user_name": "\${form.name_input}" }\`.
    -   The receiving screen must define this data in its \`data\` property: \`data: { "user_name": { "type": "string" } }\`.
    -   Use \`\${form.component_name}\` to access input from the current screen's form.
    -   Use \`\${data.variable_name}\` to access data passed from a previous screen.
8.  **Full Experience**: Create a logical, multi-screen flow (at least 2-3 screens) that fulfills the user's request.

User Request: "{{{prompt}}}"
Flow Category: "{{{category}}}"

Generate the full, valid Flow JSON now.`,
});

const generateMetaFlowFlow = ai.defineFlow(
  {
    name: 'generateMetaFlowFlow',
    inputSchema: GenerateMetaFlowInputSchema,
    outputSchema: GenerateMetaFlowOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("AI failed to generate a flow. The output was empty.");
    }
    // The AI is now responsible for generating the full object.
    // We just ensure the version is correct before returning.
    output.version = "7.1"; 
    return output;
  }
);

    
