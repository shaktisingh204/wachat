/**
 * SabCRM Finance — doc-surface kit barrel.
 *
 * The reusable document-surface kit: config-driven list page, async
 * entity picker, line-items editor, full doc form (drawer), detail
 * page with print-friendly paper + lineage rail, status-flow rail and
 * convert menu. Invoices (`/sabcrm/finance/invoices`) is the reference
 * adopter; the other finance entities configure these instead of
 * building bespoke UIs.
 */

export * from './types';
export { DocListPage, formatDocDate, formatDocMoney } from './doc-list-page';
export type { DocListPageProps } from './doc-list-page';
export { EntityPicker, type EntityPickerProps } from './entity-picker';
export {
  LineItemsEditor,
  blankDocLine,
  type LineItemsEditorProps,
} from './line-items-editor';
export { DocForm, emptyDocFormValues, type DocFormProps } from './doc-form';
export {
  DocDetailPage,
  type DocDetailPageProps,
  type DocDetailParty,
  type DocDetailTotals,
} from './doc-detail-page';
export { StatusFlow, type StatusFlowProps } from './status-flow';
export {
  ConvertMenu,
  type ConvertMenuItem,
  type ConvertMenuProps,
} from './convert-menu';
