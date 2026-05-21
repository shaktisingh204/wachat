/**
 * View-model for the template editor (Page 10).
 *
 * The wire shape lives in `@/lib/sabsms/types#SabsmsTemplate`. This file
 * carries the editor's local state shape — what `editor.tsx` owns and
 * what the server actions in `./actions.ts` accept.
 */

import type {
  SabsmsTemplate,
  SabsmsTemplateBody,
  SabsmsTemplateCategory,
  SabsmsTemplateStatus,
} from "@/lib/sabsms/types";

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "de", label: "Deutsch" },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

export const TEMPLATE_CATEGORIES: SabsmsTemplateCategory[] = [
  "transactional",
  "otp",
  "marketing",
  "alert",
  "service",
];

export interface TemplateEditorMetadata {
  /** India DLT registration. */
  dlt: {
    principalEntityId: string;
    templateId: string;
    headerId: string;
    contentCategory: string;
  };
  /** US 10DLC registration. Also carries page-unique toggles. */
  tendlc: {
    brandId: string;
    campaignId: string;
    useCase: string;
    sampleMessages: string[];
    /** Feature 19 — when true, links in the body are wrapped with the
     *  workspace short-link prefix at send time. */
    autoLinkWrap: boolean;
    /** Feature 20 — when true, footer "Reply STOP to unsubscribe" is
     *  appended to every send. */
    footerInjection: boolean;
  };
}

export interface VariableDefault {
  name: string;
  defaultValue: string;
}

export interface TemplateEditorViewModel {
  /** Empty string when creating (id === "new"). */
  id: string;
  name: string;
  category: SabsmsTemplateCategory;
  status: SabsmsTemplateStatus;
  reviewerNotes: string;
  bodies: SabsmsTemplateBody[];
  variableDefaults: VariableDefault[];
  metadata: TemplateEditorMetadata;
  /** Last-published body cached for diff'ing — `null` if no prior
   *  published version exists. */
  lastPublishedBodies: SabsmsTemplateBody[] | null;
}

export function emptyViewModel(): TemplateEditorViewModel {
  return {
    id: "",
    name: "",
    category: "transactional",
    status: "draft",
    reviewerNotes: "",
    bodies: [{ locale: "en", body: "" }],
    variableDefaults: [],
    metadata: {
      dlt: { principalEntityId: "", templateId: "", headerId: "", contentCategory: "" },
      tendlc: {
        brandId: "",
        campaignId: "",
        useCase: "",
        sampleMessages: [],
        autoLinkWrap: false,
        footerInjection: false,
      },
    },
    lastPublishedBodies: null,
  };
}

export function fromTemplateDoc(
  doc: SabsmsTemplate,
  lastPublishedBodies: SabsmsTemplateBody[] | null,
): TemplateEditorViewModel {
  const meta = (doc as unknown as {
    autoLinkWrap?: boolean;
    footerInjection?: boolean;
    variableDefaults?: VariableDefault[];
  }) ?? {};
  return {
    id: doc._id ? String(doc._id) : "",
    name: doc.name,
    category: doc.category,
    status: doc.status,
    reviewerNotes: doc.reviewerNotes ?? "",
    bodies: doc.bodies?.length ? doc.bodies : [{ locale: "en", body: "" }],
    variableDefaults: meta.variableDefaults ?? [],
    metadata: {
      dlt: {
        principalEntityId: doc.dlt?.principalEntityId ?? "",
        templateId: doc.dlt?.templateId ?? "",
        headerId: doc.dlt?.headerId ?? "",
        contentCategory: doc.dlt?.contentCategory ?? "",
      },
      tendlc: {
        brandId: doc.tendlc?.brandId ?? "",
        campaignId: doc.tendlc?.campaignId ?? "",
        useCase: doc.tendlc?.useCase ?? "",
        sampleMessages: doc.tendlc?.sampleMessages ?? [],
        autoLinkWrap: Boolean(meta.autoLinkWrap),
        footerInjection: Boolean(meta.footerInjection),
      },
    },
    lastPublishedBodies,
  };
}
