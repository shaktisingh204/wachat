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
