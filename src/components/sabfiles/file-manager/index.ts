/**
 * SabFiles — file-manager surfaces.
 *
 * The file browser (FilesPage), upload card, picker/input, and card
 * collections. Relocated here from the 20ui composites so SabFiles owns
 * all file UX per the project policy. These are pure-20ui components
 * (they consume 20ui primitives via @/components/sabcrm/20ui/composites/*).
 */
export {
  SabFileUploadCard,
  type SabFileUploadCardProps,
  type SabFileUploadItem,
} from "./file-upload-card";
export {
  SabFileCardCollections,
  type SabFileCardCollectionsProps,
  type SabFileCardItem,
} from "./file-card-collections";
export {
  SabFilesPage,
  SabFileToolbar,
  SabFileGrid,
  SabFileList,
  SabFilePreviewDialog,
  SabFileRenameDialog,
  SabFileDeleteDialog,
  SabFileShareDialog,
  SabFileUploadDialog,
  type SabFilesPageProps,
  type SabFileToolbarProps,
  type SabFileGridProps,
  type SabFileListProps,
  type SabFilePreviewDialogProps,
  type SabFileRenameDialogProps,
  type SabFileDeleteDialogProps,
  type SabFileShareDialogProps,
  type SabFileShareAccess,
  type SabFileUploadDialogProps,
  type SabFileEntity,
  type SabFileView,
} from "./files-module";
export {
  SabFilePicker,
  SabFileInput,
  type SabFilePickerProps,
  type SabFileInputProps,
} from "./file-picker";
