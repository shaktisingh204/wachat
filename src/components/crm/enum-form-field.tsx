'use client';

/**
 * <EnumFormField> — drop-in replacement for raw `<select>` /
 * `<Select>` dropdowns whose values come from one of the catalogued
 * named enums in `src/data/reference/crm-enums.ts`.
 *
 * Renders an `<EntityFormField entity="enum" filter={{ enumName }} />`
 * under the hood so consumers get the full picker UX for free —
 * search, recents, inline-create ("can't find your value? type it"),
 * a real chip with the human label, and dual-write of `idName` ↔
 * `labelName` into FormData.
 *
 * Migration pattern from a `<Select>`:
 *
 *   <Select value={status} onChange={setStatus}>
 *     <option value="draft">Draft</option>
 *     <option value="sent">Sent</option>
 *     …
 *   </Select>
 *
 * becomes
 *
 *   <EnumFormField
 *     name="status"
 *     enumName="invoiceStatus"
 *     initialId={status}
 *     onChange={setStatus}
 *   />
 *
 * If the enum the form needs isn't catalogued yet, add it to
 * `CRM_ENUMS` — the picker handles the rest, and the inline-create row
 * means users aren't blocked by missing entries.
 */

import * as React from 'react';
import { EntityFormField, type EntityFormFieldProps } from './entity-form-field';
import type { CrmEnumName } from '@/data/reference/crm-enums';

type InheritedProps = Omit<
  EntityFormFieldProps,
  'entity' | 'filter' | 'allowCreate' | 'inlineCreate'
>;

export interface EnumFormFieldProps extends InheritedProps {
  /**
   * Enum identifier from `CRM_ENUMS`. Type-narrowed so a typo at the
   * call-site (e.g. `enumName="invoiceStatuss"`) fails the TS build
   * instead of silently rendering an empty picker.
   */
  enumName: CrmEnumName;
  /**
   * Default `true` — the inline-create affordance lets a user type a
   * one-off value when the canonical list is missing a case. Set to
   * `false` to lock the picker to the catalogued values only.
   */
  allowInlineCreate?: boolean;
}

export function EnumFormField({
  enumName,
  allowInlineCreate = true,
  ...rest
}: EnumFormFieldProps) {
  const filter = React.useMemo(() => ({ enumName }), [enumName]);

  return (
    <EntityFormField
      {...rest}
      entity="enum"
      filter={filter}
      allowCreate={allowInlineCreate}
      inlineCreate={allowInlineCreate}
    />
  );
}

export default EnumFormField;
