/**
 * SabCRM Page-Layouts — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type/interface the page-layout actions surface to their (client) callers
 * lives in this plain sibling module. Importing it has no runtime cost.
 *
 * These re-export the Rust page-layouts client wire shapes
 * (`@/lib/rust-client/sabcrm-page-layouts`) the Twenty-faithful record-show
 * page layout editor consumes.
 */

export type {
  SabcrmRustPageLayout,
  SabcrmLayoutTab,
  SabcrmLayoutWidget,
  SabcrmWidgetType,
} from '@/lib/rust-client/sabcrm-page-layouts';
