/**
 * Re-export shim — the rich-text editor was promoted to a shared 20ui
 * composite (`src/components/sabcrm/20ui/composites/editor/rich-text.tsx`,
 * NOT exported through the 20ui barrel — import the composite path directly).
 * This shim keeps the legacy `record-detail-tw.tsx` imports compiling; new
 * consumers should import the composite path.
 */
export * from '@/components/sabcrm/20ui/composites/editor/rich-text';
export { default } from '@/components/sabcrm/20ui/composites/editor/rich-text';
