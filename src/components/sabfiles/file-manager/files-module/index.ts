/**
 * Files module — composed file browser surface plus its 5 dialogs.
 * Use `SabFilesPage` for the all-in-one experience, or assemble from
 * the individual pieces (toolbar / grid / list / dialogs) for custom
 * layouts.
 */
export {
  SabFilesPage,
  type SabFilesPageProps,
} from "./files-page";
export {
  SabFileToolbar,
  type SabFileToolbarProps,
} from "./file-toolbar";
export { SabFileGrid, type SabFileGridProps } from "./file-grid";
export { SabFileList, type SabFileListProps } from "./file-list";
export {
  SabFilePreviewDialog,
  type SabFilePreviewDialogProps,
} from "./file-preview-dialog";
export {
  SabFileRenameDialog,
  type SabFileRenameDialogProps,
} from "./file-rename-dialog";
export {
  SabFileDeleteDialog,
  type SabFileDeleteDialogProps,
} from "./file-delete-dialog";
export {
  SabFileShareDialog,
  type SabFileShareDialogProps,
  type SabFileShareAccess,
} from "./file-share-dialog";
export {
  SabFileUploadDialog,
  type SabFileUploadDialogProps,
} from "./file-upload-dialog";
export type { SabFileEntity, SabFileView } from "./types";
