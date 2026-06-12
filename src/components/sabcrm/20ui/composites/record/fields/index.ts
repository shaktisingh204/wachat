/**
 * RecordSurface field system — registry + barrel.
 *
 * `getFieldDisplay(type)` / `getFieldEditor(type)` resolve a component for
 * every {@link FieldType}; unknown / future types degrade to the TEXT pair so
 * a record never fails to render. Components all speak the shared
 * {@link FieldDisplayProps} / {@link FieldEditorProps} contract from
 * `./shared`.
 *
 * NOTE: imports inside this folder are relative (never the 20ui root barrel)
 * to avoid the barrel self-cycle.
 */

import type { FieldType } from '@/lib/sabcrm/types';

import type { FieldDisplayComponent, FieldEditorComponent } from './shared';
import { BooleanDisplay, BooleanEditor } from './boolean';
import {
  AddressDisplay,
  AddressEditor,
  ArrayDisplay,
  ArrayEditor,
  EmailsDisplay,
  EmailsEditor,
  FullNameDisplay,
  FullNameEditor,
  LinksDisplay,
  LinksEditor,
  PhonesDisplay,
  PhonesEditor,
} from './composite';
import { CurrencyDisplay, CurrencyEditor } from './currency';
import { DateDisplay, DateEditor, DateTimeDisplay, DateTimeEditor } from './date';
import { FileDisplay, FileEditor } from './file';
import { NumberDisplay, NumberEditor } from './number';
import { RatingDisplay, RatingEditor } from './rating';
import {
  ActorDisplay,
  ActorEditor,
  RelationDisplay,
  RelationEditor,
} from './relation';
import {
  MultiSelectDisplay,
  MultiSelectEditor,
  SelectDisplay,
  SelectEditor,
} from './select';
import {
  EmailDisplay,
  EmailEditor,
  LinkDisplay,
  LinkEditor,
  PhoneDisplay,
  PhoneEditor,
  RawJsonDisplay,
  RawJsonEditor,
  RichTextDisplay,
  RichTextEditor,
  TextDisplay,
  TextEditor,
} from './text';

/* =========================================================================
   Registry
   ========================================================================= */

const DISPLAYS: Record<FieldType, FieldDisplayComponent> = {
  TEXT: TextDisplay,
  NUMBER: NumberDisplay,
  NUMERIC: NumberDisplay,
  CURRENCY: CurrencyDisplay,
  BOOLEAN: BooleanDisplay,
  DATE: DateDisplay,
  DATE_TIME: DateTimeDisplay,
  EMAIL: EmailDisplay,
  PHONE: PhoneDisplay,
  LINK: LinkDisplay,
  SELECT: SelectDisplay,
  MULTI_SELECT: MultiSelectDisplay,
  RATING: RatingDisplay,
  RELATION: RelationDisplay,
  FILE: FileDisplay,
  FULL_NAME: FullNameDisplay,
  ADDRESS: AddressDisplay,
  EMAILS: EmailsDisplay,
  PHONES: PhonesDisplay,
  LINKS: LinksDisplay,
  ARRAY: ArrayDisplay,
  RAW_JSON: RawJsonDisplay,
  ACTOR: ActorDisplay,
  RICH_TEXT_V2: RichTextDisplay,
};

const EDITORS: Record<FieldType, FieldEditorComponent> = {
  TEXT: TextEditor,
  NUMBER: NumberEditor,
  NUMERIC: NumberEditor,
  CURRENCY: CurrencyEditor,
  BOOLEAN: BooleanEditor,
  DATE: DateEditor,
  DATE_TIME: DateTimeEditor,
  EMAIL: EmailEditor,
  PHONE: PhoneEditor,
  LINK: LinkEditor,
  SELECT: SelectEditor,
  MULTI_SELECT: MultiSelectEditor,
  RATING: RatingEditor,
  RELATION: RelationEditor,
  FILE: FileEditor,
  FULL_NAME: FullNameEditor,
  ADDRESS: AddressEditor,
  EMAILS: EmailsEditor,
  PHONES: PhonesEditor,
  LINKS: LinksEditor,
  ARRAY: ArrayEditor,
  RAW_JSON: RawJsonEditor,
  // ACTOR is system-written (audit trail) — its "editor" is the display.
  ACTOR: ActorEditor,
  RICH_TEXT_V2: RichTextEditor,
};

/**
 * Resolve the display component for a field type. Unknown / future types
 * degrade to the TEXT display so records never fail to render.
 */
export function getFieldDisplay(
  type: FieldType | (string & {}),
): FieldDisplayComponent {
  return (DISPLAYS as Record<string, FieldDisplayComponent>)[type] ?? TextDisplay;
}

/**
 * Resolve the editor component for a field type. Unknown / future types
 * degrade to the TEXT editor (a plain line input over `String(value)`).
 */
export function getFieldEditor(
  type: FieldType | (string & {}),
): FieldEditorComponent {
  return (EDITORS as Record<string, FieldEditorComponent>)[type] ?? TextEditor;
}

/* =========================================================================
   Re-exports
   ========================================================================= */

export * from './shared';
export * from './boolean';
export * from './composite';
export * from './currency';
export * from './date';
export * from './file';
export * from './number';
export * from './rating';
export * from './relation';
export * from './select';
export * from './text';
