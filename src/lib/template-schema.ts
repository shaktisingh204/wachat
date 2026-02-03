import { z } from 'zod';

const templateNameRegex = /^[a-z0-9_]+$/;
const variableAtStartRegex = /^{{\s*\d+\s*}}/;
const variableAtEndRegex = /{{\s*\d+\s*}}$/;

export const buttonSchema = z.object({
    type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'FLOW']),
    text: z.string().min(1, "Button text is required").max(25, "Button text must be 25 characters or less"),
    url: z.string().optional(),
    phone_number: z.string().optional(),
    payload: z.string().optional(),
    flow_id: z.string().optional(),
    example: z.array(z.string()).optional(),
}).refine(data => {
    if (data.type === 'URL' && !data.url) return false;
    if (data.type === 'PHONE_NUMBER' && !data.phone_number) return false;
    if (data.type === 'FLOW' && !data.flow_id) return false;
    return true;
}, {
    message: "Missing required field for the selected button type (URL, phone number, or flow ID).",
    path: ["type"] // Attach error to the type field though it's conditional
});

export const carouselCardSchema = z.object({
    id: z.number().optional(), // Client-side ID mainly
    headerFormat: z.enum(['IMAGE', 'VIDEO', 'NONE']),
    headerSampleUrl: z.string().optional(),
    body: z.string().min(1, "Card body text is required"),
    buttons: z.array(buttonSchema).max(2, "Each carousel card can have a maximum of 2 buttons.")
});

export const createTemplateSchema = z.object({
    name: z.string()
        .min(1, "Template name is required")
        .max(512, "Template name cannot exceed 512 characters")
        .regex(templateNameRegex, "Template name can only contain lowercase letters, numbers, and underscores (_)"),
    category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION', 'INTERACTIVE']), // INTERACTIVE for Catalog
    language: z.string().min(1, "Language is required"),
    templateType: z.enum(['STANDARD', 'MARKETING_CAROUSEL', 'CATALOG_MESSAGE']).optional(), // Optional because server action logic might differ slightly in how it receives this

    // Standard Template Fields
    body: z.string().optional().refine((val) => {
        if (!val) return true; // Optional here, checked in overall refine if type is standard
        const trimmed = val.trim();
        if (variableAtStartRegex.test(trimmed) || variableAtEndRegex.test(trimmed)) {
            return false;
        }
        return true;
    }, { message: "Variables (e.g. {{1}}) cannot be at the very beginning or end of the body text. Please add words before and after." }),

    headerFormat: z.string().optional(),
    headerText: z.string().optional(),
    footer: z.string().max(60, "Footer cannot exceed 60 characters").optional(),
    buttons: z.array(buttonSchema).max(10, "Maximum 10 buttons allowed (depending on type mix).").optional(),

    // Marketing Carousel Fields
    carouselCards: z.array(carouselCardSchema).max(10, "Maximum 10 carousel cards allowed.").optional(),

    // Catalog Message Fields
    catalogId: z.string().optional(),
    carouselHeader: z.string().optional(),
    carouselBody: z.string().optional(),
    carouselFooter: z.string().optional(),
    section1Title: z.string().optional(),
    section1ProductIDs: z.string().optional(),
    section2Title: z.string().optional(),
    section2ProductIDs: z.string().optional(),

}).superRefine((data, ctx) => {
    // Specific validations based on inferred or explicit type
    // Since we handle different types in one schema to match the messy FormData world:

    // We can infer type from presence of fields if templateType not set, but better to rely on what we can.

    // STANDARD validation logic check
    if (data.templateType === 'STANDARD' || (!data.templateType && !data.carouselCards && !data.catalogId)) {
        if (!data.body || data.body.trim().length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Body text is required for standard templates.",
                path: ["body"]
            });
        }
    }

    // MARKETING_CAROUSEL validation
    if (data.templateType === 'MARKETING_CAROUSEL' || (data.carouselCards && data.carouselCards.length > 0)) {
        if (!data.carouselCards || data.carouselCards.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "At least one card is required for a carousel.",
                path: ["carouselCards"]
            });
        }
    }

    // CATALOG_MESSAGE validation
    if (data.templateType === 'CATALOG_MESSAGE' || data.catalogId) {
        if (!data.catalogId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Catalog ID is required.", path: ["catalogId"] });
        if (!data.carouselBody) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Body text is required.", path: ["carouselBody"] });
        if (!data.section1Title) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Section 1 Title is required.", path: ["section1Title"] });
        if (!data.section1ProductIDs) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Section 1 Product IDs are required.", path: ["section1ProductIDs"] });
        if (!data.section2Title) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Section 2 Title is required.", path: ["section2Title"] });
        if (!data.section2ProductIDs) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Section 2 Product IDs are required.", path: ["section2ProductIDs"] });
    }
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
