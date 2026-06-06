/**
 * Non-legacy re-export for the SharePermissionsModal domain composite.
 *
 * The underlying implementation lives in the shared domain-components folder and
 * is itself built entirely on the 20ui design system. This shim provides a path
 * free of the legacy `zoruui-` folder prefix so consumers can import the modal
 * without pulling from a `zoru`-named location.
 */
export { SharePermissionsModal } from '@/components/zoruui-domain/share-permissions-modal';
