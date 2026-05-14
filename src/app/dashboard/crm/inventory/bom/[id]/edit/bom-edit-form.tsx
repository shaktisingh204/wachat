/**
 * Deprecated shim — the canonical form lives at
 * `../_components/bom-form` and is consumed directly by /new and
 * /[id]/edit routes. This file is kept so external imports (if any)
 * keep compiling; new code should import `BomForm` instead.
 */
export { BomForm as BomEditForm } from '../../_components/bom-form';
