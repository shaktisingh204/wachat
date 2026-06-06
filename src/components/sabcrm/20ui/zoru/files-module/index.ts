/**
 * Files module — composed file browser surface plus its 5 dialogs.
 * Use `ZoruFilesPage` for the all-in-one experience, or assemble from
 * the individual pieces (toolbar / grid / list / dialogs) for custom
 * layouts.
 */
export {
  ZoruFilesPage,
  type ZoruFilesPageProps,
} from "./files-page";
export {
  ZoruFileToolbar,
  type ZoruFileToolbarProps,
} from "./file-toolbar";
export { ZoruFileGrid, type ZoruFileGridProps } from "./file-grid";
export { ZoruFileList, type ZoruFileListProps } from "./file-list";
export {
  ZoruFilePreviewDialog,
  type ZoruFilePreviewDialogProps,
} from "./file-preview-dialog";
export {
  ZoruFileRenameDialog,
  type ZoruFileRenameDialogProps,
} from "./file-rename-dialog";
export {
  ZoruFileDeleteDialog,
  type ZoruFileDeleteDialogProps,
} from "./file-delete-dialog";
export {
  ZoruFileShareDialog,
  type ZoruFileShareDialogProps,
  type ZoruFileShareAccess,
} from "./file-share-dialog";
export {
  ZoruFileUploadDialog,
  type ZoruFileUploadDialogProps,
} from "./file-upload-dialog";
export type { ZoruFileEntity, ZoruFileView } from "./types";
