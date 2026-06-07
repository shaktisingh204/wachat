/**
 * Project-wide SabFiles UI primitives.
 *
 * The picker is the single source of truth for "pick a file or paste a
 * URL" across SabNode. New code SHOULD import from here rather than
 * building bespoke `<input type="file">` UIs.
 */
export {
    SabFilePicker,
    SabFilePickerButton,
    SabFileToFileButton,
    SabFileUrlInput,
    fetchSabFilePickAsFile,
    type SabFileAccept,
    type SabFilePick,
    type SabFilePickerProps,
    type SabFilePickerButtonProps,
    type SabFileToFileButtonProps,
    type SabFileUrlInputProps,
} from './sab-file-picker';

/**
 * File-manager surfaces (browser page, upload card, picker/input, card
 * collections), relocated here from the 20ui composites so SabFiles owns all
 * file UX. Most app code imports the clean-named surface from
 * `@/components/sabcrm/20ui` (FileUploadCard / FilesPage / FileInput /
 * FileCardCollections); new file UX can import directly from here.
 */
export * from './file-manager';
