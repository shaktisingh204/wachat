/**
 * SabUI — modern design system for SabNode.
 *
 * A focused set of primitive components built on top of the SabUI tokens
 * defined in globals.css. Intended as the long-term replacement for mixed
 * ad-hoc styling across the app. Starts in the Wachat module and spreads
 * to CRM / SabFlow / SEO / SabChat / etc. as pages are touched.
 *
 * Design principles:
 *   1. Tokens, not Tailwind classes, for colors and radii — so a single
 *      globals.css edit rethemes the entire app.
 *   2. Zero runtime dependencies beyond React + lucide-react + the Radix
 *      primitives already shipping with the app.
 *   3. Primitives compose. No "kitchen sink" components.
 *   4. Dark mode is a first-class citizen — handled via the `.dark` class
 *      that shadcn already toggles.
 */

/* Page chrome */
export * from './sab-page';
export * from './sab-page-shell';
export * from './sab-mesh-background';
export * from './sab-card';

/* Display primitives */
export * from './sab-button';
export * from './sab-chip';
export * from './sab-stat';
export * from './sab-sparkline';
export * from './sab-table';
export * from './sab-empty';

/* Form primitives */
export * from './sab-label';
export * from './sab-field';
export * from './sab-input';
export * from './sab-textarea';
export * from './sab-checkbox';
export * from './sab-radio';
export * from './sab-switch';
export * from './sab-select';

/* Overlay primitives */
export * from './sab-dialog';
