/**
 * SabFlow Recipes — package entry point.
 *
 * Re-exports the registry API and side-effect-imports each built-in recipe
 * so the registry is populated by the time consumers call `listRecipes()`.
 *
 * The recipe modules MUST be imported here (not inside `registry.ts`) — if
 * registry side-effect-imports them itself, a circular import causes the
 * recipes to call `registerRecipe(...)` before `registry.ts`'s top-level
 * `const recipeMap = new Map()` has run, and Node throws
 * "Cannot access 'recipeMap' before initialization" (TDZ).
 */

export {
  registerRecipe,
  listRecipes,
  getRecipe,
  instantiateRecipe,
} from './registry';

import './lead-to-whatsapp-welcome';
import './abandoned-cart';
import './ad-spend-alert';
import './welcome-onboarding';
import './payment-received';
