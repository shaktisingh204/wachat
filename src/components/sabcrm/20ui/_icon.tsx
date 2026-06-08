import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * The two shapes callers pass for an "icon" across 20ui:
 *  - a component to render (a Lucide icon — which is a `forwardRef` *object*,
 *    not a function — or any other component), or
 *  - an already-rendered node (`<Search />`, an emoji, a `<span>`).
 *
 * Mixing these is the single most common crash in the migrated UI:
 *   - render a component as a child  → "Objects are not valid as a React child
 *     (found: object with keys {$$typeof, render})"
 *   - render an element as a component (`<Icon />`) → "Element type is invalid
 *     … got: <svg />"
 *
 * `renderIcon` accepts either and always returns a valid React node, so every
 * 20ui primitive can be tolerant of both calling conventions.
 */
export type IconProp = LucideIcon | React.ReactNode;

/** True when `icon` is a component type (function OR forwardRef/memo object). */
export function isIconComponent(icon: unknown): icon is React.ComponentType<unknown> {
  if (typeof icon === 'function') return true;
  return (
    typeof icon === 'object' &&
    icon !== null &&
    '$$typeof' in (icon as object) &&
    !React.isValidElement(icon)
  );
}

/**
 * Normalise an `IconProp` to a renderable node. A component type is created
 * with `props` (e.g. `{ size: 16 }`); an already-rendered element/node is
 * returned untouched; nullish input yields `null`.
 */
export function renderIcon(
  icon: IconProp | undefined | null,
  props?: Record<string, unknown>,
): React.ReactNode {
  if (icon == null || icon === false) return null;
  if (isIconComponent(icon)) {
    return React.createElement(icon as React.ComponentType<unknown>, props);
  }
  // Already an element, string, number, or fragment — render as-is.
  return icon as React.ReactNode;
}
