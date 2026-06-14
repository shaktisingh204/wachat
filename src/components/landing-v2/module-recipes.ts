import type { ModuleSlug } from './modules-data';

export type SectionId =
    | 'trust' | 'problem' | 'flow' | 'stats' | 'features' | 'spotlights'
    | 'use-cases' | 'ai' | 'integrations' | 'workflow' | 'comparison'
    | 'security' | 'pricing' | 'testimonial' | 'faq' | 'related' | 'bespoke';

export type BespokeId =
    // category-default surfaces (from category-sections.tsx)
    | 'conversation' | 'marketing' | 'commerce' | 'success' | 'people' | 'productivity'
    | 'engineering' | 'analytics' | 'files' | 'acquisition'
    // extra surfaces (from bespoke-extras.tsx)
    | 'broadcast' | 'bot-builder' | 'call-queue' | 'storefront' | 'api-playground'
    | 'knowledge-base' | 'qr-studio' | 'recording-library' | 'funnel-chart'
    | 'vault' | 'esign' | 'roadmap' | 'slide-editor' | 'sheet' | 'tables'
    | 'loyalty' | 'community' | 'booking' | 'affiliate' | 'ab-test'
    | 'field-jobs' | 'client-portal' | 'ops-command'
    // module-specific rich showcase (from sections/*)
    | 'sabcall';

export interface Recipe {
    bespoke: BespokeId;
    sections: SectionId[];
}

// Each of the 47 modules gets a unique recipe: its own bespoke surface choice
// and its own section order. No two are the same.
export const MODULE_RECIPES: Record<ModuleSlug, Recipe> = {
    // ── Conversation ──
    wachat:       { bespoke: 'broadcast',         sections: ['trust', 'bespoke', 'spotlights', 'features', 'ai', 'flow', 'stats', 'integrations', 'security', 'comparison', 'testimonial', 'pricing', 'faq', 'related'] },
    sabchat:      { bespoke: 'conversation',      sections: ['trust', 'bespoke', 'features', 'ai', 'spotlights', 'flow', 'stats', 'integrations', 'use-cases', 'testimonial', 'comparison', 'pricing', 'faq', 'related'] },
    telegram:     { bespoke: 'bot-builder',       sections: ['trust', 'features', 'bespoke', 'spotlights', 'integrations', 'stats', 'pricing', 'faq', 'related'] },
    instagram:    { bespoke: 'conversation',      sections: ['trust', 'bespoke', 'spotlights', 'features', 'ai', 'use-cases', 'integrations', 'pricing', 'faq', 'related'] },
    'meta-suite': { bespoke: 'conversation',      sections: ['trust', 'features', 'bespoke', 'spotlights', 'workflow', 'integrations', 'security', 'pricing', 'faq', 'related'] },
    sabsms:       { bespoke: 'broadcast',         sections: ['trust', 'features', 'bespoke', 'flow', 'spotlights', 'integrations', 'comparison', 'pricing', 'faq', 'related'] },
    sabcall:      { bespoke: 'sabcall',           sections: ['trust', 'flow', 'bespoke', 'features', 'spotlights', 'ai', 'stats', 'comparison', 'security', 'integrations', 'pricing', 'faq', 'related'] },

    // ── Marketing ──
    sabmail:       { bespoke: 'marketing',         sections: ['trust', 'features', 'bespoke', 'spotlights', 'workflow', 'stats', 'integrations', 'security', 'pricing', 'faq', 'related'] },
    sabpublish:    { bespoke: 'booking',           sections: ['trust', 'bespoke', 'features', 'spotlights', 'use-cases', 'integrations', 'pricing', 'faq', 'related'] },
    sabcreator:    { bespoke: 'affiliate',         sections: ['trust', 'features', 'bespoke', 'spotlights', 'stats', 'integrations', 'pricing', 'faq', 'related'] },
    sabcatalyst:   { bespoke: 'ab-test',           sections: ['trust', 'bespoke', 'features', 'workflow', 'spotlights', 'ai', 'integrations', 'pricing', 'faq', 'related'] },
    'ad-manager':  { bespoke: 'marketing',         sections: ['trust', 'features', 'bespoke', 'spotlights', 'stats', 'comparison', 'integrations', 'pricing', 'faq', 'related'] },

    // ── Sales & Commerce ──
    crm:           { bespoke: 'commerce',          sections: ['trust', 'features', 'bespoke', 'spotlights', 'flow', 'stats', 'integrations', 'comparison', 'security', 'use-cases', 'testimonial', 'pricing', 'faq', 'related'] },
    sabshop:       { bespoke: 'storefront',        sections: ['trust', 'bespoke', 'features', 'spotlights', 'flow', 'integrations', 'stats', 'pricing', 'faq', 'related'] },
    sabcheckout:   { bespoke: 'commerce',          sections: ['trust', 'features', 'bespoke', 'workflow', 'spotlights', 'security', 'integrations', 'pricing', 'faq', 'related'] },

    // ── Customer Success ──
    sabdesk:       { bespoke: 'knowledge-base',    sections: ['trust', 'features', 'bespoke', 'spotlights', 'ai', 'stats', 'security', 'integrations', 'testimonial', 'pricing', 'faq', 'related'] },
    sabrequests:   { bespoke: 'success',           sections: ['trust', 'bespoke', 'features', 'workflow', 'spotlights', 'security', 'pricing', 'faq', 'related'] },

    // ── People & Operations ──
    hrm:           { bespoke: 'people',            sections: ['trust', 'problem', 'bespoke', 'features', 'spotlights', 'flow', 'stats', 'security', 'use-cases', 'testimonial', 'pricing', 'faq', 'related'] },
    sabops:        { bespoke: 'ops-command',       sections: ['trust', 'bespoke', 'features', 'workflow', 'spotlights', 'security', 'integrations', 'pricing', 'faq', 'related'] },
    sabworkerly:   { bespoke: 'field-jobs',        sections: ['trust', 'features', 'bespoke', 'spotlights', 'flow', 'stats', 'pricing', 'faq', 'related'] },
    sabpractice:   { bespoke: 'client-portal',     sections: ['trust', 'bespoke', 'features', 'spotlights', 'workflow', 'security', 'pricing', 'faq', 'related'] },

    // ── Productivity ──
    sabmeet:       { bespoke: 'productivity',      sections: ['trust', 'features', 'bespoke', 'spotlights', 'integrations', 'use-cases', 'pricing', 'faq', 'related'] },
    sabwebinar:    { bespoke: 'recording-library', sections: ['trust', 'bespoke', 'features', 'spotlights', 'stats', 'pricing', 'faq', 'related'] },
    sabshow:       { bespoke: 'slide-editor',      sections: ['trust', 'features', 'bespoke', 'spotlights', 'use-cases', 'integrations', 'pricing', 'faq', 'related'] },

    // ── Engineering ──
    sabflow:       { bespoke: 'engineering',       sections: ['trust', 'bespoke', 'features', 'workflow', 'spotlights', 'ai', 'integrations', 'stats', 'comparison', 'security', 'pricing', 'faq', 'related'] },
    sabmonitor:    { bespoke: 'api-playground',    sections: ['trust', 'features', 'bespoke', 'spotlights', 'workflow', 'stats', 'security', 'pricing', 'faq', 'related'] },
    sabbugs:       { bespoke: 'engineering',       sections: ['trust', 'problem', 'features', 'bespoke', 'spotlights', 'workflow', 'integrations', 'pricing', 'faq', 'related'] },
    sabsprints:    { bespoke: 'roadmap',           sections: ['trust', 'bespoke', 'features', 'spotlights', 'workflow', 'use-cases', 'pricing', 'faq', 'related'] },

    // ── Analytics & AI ──
    sablens:       { bespoke: 'funnel-chart',      sections: ['trust', 'bespoke', 'features', 'spotlights', 'ai', 'integrations', 'security', 'pricing', 'faq', 'related'] },
    sabsense:      { bespoke: 'ab-test',           sections: ['trust', 'features', 'bespoke', 'spotlights', 'workflow', 'stats', 'pricing', 'faq', 'related'] },
    sabbi:         { bespoke: 'analytics',         sections: ['trust', 'bespoke', 'features', 'spotlights', 'workflow', 'integrations', 'security', 'pricing', 'faq', 'related'] },
    sabbigin:      { bespoke: 'analytics',         sections: ['trust', 'features', 'bespoke', 'ai', 'spotlights', 'integrations', 'stats', 'pricing', 'faq', 'related'] },

    // ── Files & Documents ──
    sabfiles:      { bespoke: 'files',             sections: ['trust', 'features', 'bespoke', 'spotlights', 'security', 'integrations', 'pricing', 'faq', 'related'] },
    sabsign:       { bespoke: 'esign',             sections: ['trust', 'bespoke', 'features', 'spotlights', 'flow', 'security', 'pricing', 'faq', 'related'] },
    sabsheet:      { bespoke: 'sheet',             sections: ['trust', 'features', 'bespoke', 'spotlights', 'integrations', 'use-cases', 'pricing', 'faq', 'related'] },
    sabtables:     { bespoke: 'tables',            sections: ['trust', 'bespoke', 'features', 'spotlights', 'workflow', 'integrations', 'pricing', 'faq', 'related'] },
    sabprep:       { bespoke: 'knowledge-base',    sections: ['trust', 'features', 'bespoke', 'spotlights', 'use-cases', 'pricing', 'faq', 'related'] },

    // ── Acquisition ──
    seo:                 { bespoke: 'acquisition',  sections: ['trust', 'bespoke', 'features', 'spotlights', 'workflow', 'stats', 'integrations', 'testimonial', 'pricing', 'faq', 'related'] },
    'website-builder':   { bespoke: 'acquisition',  sections: ['trust', 'features', 'bespoke', 'spotlights', 'integrations', 'use-cases', 'pricing', 'faq', 'related'] },
    'url-shortener':     { bespoke: 'qr-studio',    sections: ['trust', 'bespoke', 'features', 'spotlights', 'stats', 'integrations', 'pricing', 'faq', 'related'] },
    'qr-code-maker':     { bespoke: 'qr-studio',    sections: ['trust', 'features', 'bespoke', 'spotlights', 'use-cases', 'pricing', 'faq', 'related'] },
};

export function recipeFor(slug: ModuleSlug): Recipe {
    return MODULE_RECIPES[slug];
}
