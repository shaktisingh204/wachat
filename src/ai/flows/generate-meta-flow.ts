
'use server';
/**
 * @fileOverview Generates a complete, multi-screen Meta Flow JSON structure based on a user's prompt.
 *
 * This file defines the `generateMetaFlow` function, which takes a user's prompt
 * and a category to generate a valid Meta Flow JSON object using the declarative layout structure.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Zod Schemas for Meta Flow JSON Structure (Declarative Layout Style v7.1) ---

const ActionSchema = z.object({
  name: z.enum(['navigate', 'complete', 'data_exchange', 'open_url']).describe("Action type."),
  next: z.object({ type: z.literal('screen'), name: z.string() }).optional().describe("For 'navigate', the ID of the next screen."),
  payload: z.record(z.any()).optional().describe("Data to be submitted or passed. Use variables like ${form.input_name} or ${data.variable_name}."),
});

// --- Component Schemas ---
const TextInputSchema = z.object({ type: z.literal('TextInput'), name: z.string(), label: z.string(), "helper-text": z.string().optional(), required: z.boolean().optional(), "input-type": z.enum(['text', 'email', 'password']).optional(), "max-length": z.number().optional() });
const TextAreaSchema = z.object({ type: z.literal('TextArea'), name: z.string(), label: z.string(), "helper-text": z.string().optional(), required: z.boolean().optional(), "max-length": z.number().optional() });
const DropdownSchema = z.object({ type: z.literal('Dropdown'), name: z.string(), label: z.string(), "data-source": z.array(z.object({ id: z.string(), title: z.string() })), required: z.boolean().optional() });
const RadioButtonsGroupSchema = z.object({ type: z.literal('RadioButtonsGroup'), name: z.string(), label: z.string(), "data-source": z.array(z.object({ id: z.string(), title: z.string() })), required: z.boolean().optional() });
const CheckboxGroupSchema = z.object({ type: z.literal('CheckboxGroup'), name: z.string(), label: z.string(), "data-source": z.array(z.object({ id: z.string(), title: z.string() })), required: z.boolean().optional() });
const DatePickerSchema = z.object({ type: z.literal('DatePicker'), name: z.string(), label: z.string(), "min-date": z.string().optional(), "max-date": z.string().optional(), required: z.boolean().optional(), "on-select-action": ActionSchema.optional() });
const FooterSchema = z.object({ type: z.literal('Footer'), label: z.string(), "on-click-action": ActionSchema });
const EmbeddedLinkSchema = z.object({ type: z.literal('EmbeddedLink'), text: z.string(), "on-click-action": ActionSchema, visible: z.boolean().optional() });
const TextHeadingSchema = z.object({ type: z.literal('TextHeading'), text: z.string() });
const TextSubheadingSchema = z.object({ type: z.literal('TextSubheading'), text: z.string() });
const TextBodySchema = z.object({ type: z.literal('TextBody'), text: z.string() });
const TextCaptionSchema = z.object({ type: z.literal('TextCaption'), text: z.string() });
const PhotoPickerSchema = z.object({ type: z.literal('PhotoPicker'), name: z.string(), label: z.string(), required: z.boolean().optional(), "min-uploaded-photos": z.number().optional(), "max-uploaded-photos": z.number().optional() });
const DocumentPickerSchema = z.object({ type: z.literal('DocumentPicker'), name: z.string(), label: z.string(), required: z.boolean().optional(), "min-uploaded-documents": z.number().optional(), "max-uploaded-documents": z.number().optional() });
const CalendarPickerSchema = z.object({ type: z.literal('CalendarPicker'), name: z.string(), label: z.union([z.string(), z.object({ "start-date": z.string(), "end-date": z.string() })]), mode: z.enum(['single', 'range']), "on-select-action": ActionSchema.optional() });
const ChipsSelectorSchema = z.object({ type: z.literal('ChipsSelector'), name: z.string(), label: z.string(), "data-source": z.array(z.object({ id: z.string(), title: z.string() })), "max-selected-items": z.number().optional(), "min-selected-items": z.number().optional() });
const ImageCarouselSchema = z.object({ type: z.literal('ImageCarousel'), name: z.string(), images: z.array(z.object({ "alt-text": z.string(), src: z.string() })) });
const OptInSchema = z.object({ type: z.literal('OptIn'), name: z.string(), label: z.string(), required: z.boolean().optional() });
const ImageSchema = z.object({ type: z.literal('Image'), src: z.string(), "alt-text": z.string() });

// The If and Switch components require recursive definitions.
const FormComponentSchema: z.ZodType<any> = z.lazy(() => z.union([
    TextInputSchema, TextAreaSchema, DropdownSchema, RadioButtonsGroupSchema, CheckboxGroupSchema, DatePickerSchema, FooterSchema, EmbeddedLinkSchema,
    TextHeadingSchema, TextSubheadingSchema, TextBodySchema, TextCaptionSchema, PhotoPickerSchema, DocumentPickerSchema, CalendarPickerSchema,
    ChipsSelectorSchema, ImageCarouselSchema, OptInSchema, ImageSchema,
    z.object({ type: z.literal('If'), condition: z.string(), then: z.array(FormComponentSchema), else: z.array(FormComponentSchema).optional() }),
    z.object({ type: z.literal('Switch'), value: z.string(), cases: z.record(z.array(FormComponentSchema)) })
]));

const FormSchema = z.object({
  type: z.literal('Form'),
  name: z.string(),
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
  "list-items": z.union([z.string().describe("A dynamic variable like ${data.insurances}"), z.array(NavigationListItemSchema)]),
  "on-click-action": ActionSchema.optional(),
});

const ScreenLayoutChildSchema = z.union([FormSchema, NavigationListSchema]);

const ScreenSchema = z.object({
  id: z.string().describe("A unique identifier for the screen, e.g., 'SURVEY_START'."),
  title: z.string().describe("The title of the screen."),
  layout: z.object({
      type: z.literal('SingleColumnLayout'),
      children: z.array(ScreenLayoutChildSchema),
  }),
  terminal: z.boolean().optional().describe("If true, this is a final screen in the flow."),
  success: z.boolean().optional().describe("Used with terminal screens to indicate success."),
  data: z.record(z.any()).optional().describe("Defines data structure for dynamic content."),
});

const FlowJSONSchema = z.object({
  version: z.literal("7.1"),
  data_api_version: z.literal("3.0").optional(),
  name: z.string().describe("The name of the flow."),
  description: z.string().optional().describe("A brief description of the flow."),
  routing_model: z.record(z.array(z.string())).optional().describe("Defines the navigation paths between screens."),
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
  name: 'generateMetaFlowPrompt_v7_declarative',
  input: { schema: GenerateMetaFlowInputSchema },
  output: { schema: GenerateMetaFlowOutputSchema },
  prompt: `You are an expert in creating interactive WhatsApp Flows using Meta's latest **declarative** Flow JSON format (v7.1). Your task is to generate a complete, multi-screen Flow JSON object based on the user's request.

The output must strictly adhere to the provided JSON schema.

RULES:
1.  **Structure**: The root must contain 'version' and 'screens'. Each screen has 'id', 'title', and a 'layout'. The layout contains a 'Form' or 'NavigationList' which in turn has 'children' components.
2.  **Navigation**: Use a 'Footer' component with an 'on-click-action' for navigation.
    - To go to the next screen, use: 'on-click-action': { 'name': 'navigate', 'next': { 'type': 'screen', 'name': 'screen_id_of_next_screen' } }.
    - The FINAL screen's footer MUST use: 'on-click-action': { 'name': 'complete' }.
3.  **Unique IDs**: All 'screen' IDs and component 'name' properties within a form must be unique strings (e.g., "SURVEY_START", "text_input_name").
4.  **Component Variety**: Use a variety of the available components based on the user's prompt (e.g., TextInput, DatePicker, Dropdown, RadioButtonsGroup).
5.  **Data Passing**: To pass data between screens, include a 'payload' in the footer's 'on-click-action'. Define the corresponding variables in the 'data' section of the target screen.
6.  **Full Experience**: Create at least 2-3 screens for an interactive flow (e.g., a welcome screen, one or more data collection screens, and a final thank you/confirmation screen).

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

