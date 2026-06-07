/**
 * Non-legacy re-export for the SharePermissionsModal domain composite.
 *
 * The underlying implementation lives in the shared domain-components folder and
 * is itself built entirely on the 20ui design system. This shim provides a path
 * free of the legacy `ui20-` folder prefix so consumers can import the modal
 * without pulling from a `ui20`-named location.
 */
export { SharePermissionsModal } from '@/components/20ui-domain/share-permissions-modal';
