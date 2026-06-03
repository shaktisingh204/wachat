/**
 * SabCRM Templates — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the templates actions surface to their (client) callers
 * lives in this plain sibling module. Importing it has no runtime cost.
 *
 * These wrap the Rust templates client wire shapes
 * (`@/lib/rust-client/sabcrm-templates`) into the small, serialisable
 * payloads the SabCRM UI consumes.
 */

import type {
  SabcrmRustTemplate,
  SabcrmTemplateCreateInput,
  SabcrmTemplateUpdateInput,
} from '@/lib/rust-client/sabcrm-templates';

export type {
  SabcrmRustTemplate,
  SabcrmTemplateKind,
  SabcrmTemplateCreateInput,
  SabcrmTemplateUpdateInput,
} from '@/lib/rust-client/sabcrm-templates';

/** Input accepted by {@link createTemplateTw}. */
export type CreateTemplateTwInput = SabcrmTemplateCreateInput;

/** Partial patch accepted by {@link updateTemplateTw}. */
export type UpdateTemplateTwPatch = SabcrmTemplateUpdateInput;

/** A single template, as returned by the actions. */
export type SabcrmTemplateTw = SabcrmRustTemplate;
