// Transforms a rich-text composite field value — converts between blocknote JSON and markdown.
// PORT-NOTE: @blocknote/server-util is an ESM-only package. The native import() trick from the
// source is preserved here. The richTextValueSchema validation logic is inlined (no twenty-shared dep).

import type { ServerBlockNoteEditor } from "@blocknote/server-util";

export type RichTextMetadata = {
  markdown: string | null;
  blocknote: string | null;
};

// Inline minimal schema for rich-text value shape
function parseRichTextValue(value: string): RichTextMetadata {
  try {
    const parsed = JSON.parse(value);
    return {
      markdown: typeof parsed?.markdown === "string" ? parsed.markdown : null,
      blocknote:
        typeof parsed?.blocknote === "string" ? parsed.blocknote : null,
    };
  } catch {
    return { markdown: null, blocknote: null };
  }
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// Reuse a single ServerBlockNoteEditor across all calls to avoid
// the cost of dynamic import resolution + instance creation (~90ms) on every transform.
let cachedServerBlockNoteEditor: ServerBlockNoteEditor | null = null;

// SWC compiles import() to require() in CJS mode, which breaks ESM-only
// transitive dependencies in @blocknote/core. Native import() resolves
// the ESM bundle path where the full chain works.
// eslint-disable-next-line no-new-func
const nativeImport = new Function("specifier", "return import(specifier)");

const getServerBlockNoteEditor =
  async (): Promise<ServerBlockNoteEditor> => {
    if (cachedServerBlockNoteEditor) {
      return cachedServerBlockNoteEditor;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module: any = await nativeImport("@blocknote/server-util");
    const editor: ServerBlockNoteEditor =
      module.ServerBlockNoteEditor.create();

    cachedServerBlockNoteEditor = editor;

    return editor;
  };

export const transformRichTextValue = async (
  richTextValue: unknown,
): Promise<RichTextMetadata> => {
  const parsedValue = isNonEmptyString(richTextValue)
    ? parseRichTextValue(richTextValue)
    : (richTextValue as RichTextMetadata);

  const serverBlockNoteEditor = await getServerBlockNoteEditor();

  // Patch: Handle cases where blocknote to markdown conversion fails for certain block types (custom/code blocks)
  // Todo : This may be resolved once the server-utils library is updated with proper conversion support - #947
  let convertedMarkdown: string | null = null;

  try {
    convertedMarkdown = isDefined(parsedValue?.blocknote)
      ? await serverBlockNoteEditor.blocksToMarkdownLossy(
          JSON.parse(parsedValue.blocknote as string),
        )
      : null;
  } catch {
    convertedMarkdown = (parsedValue?.blocknote as string | null) || null;
  }

  const convertedBlocknote = parsedValue?.markdown
    ? JSON.stringify(
        await serverBlockNoteEditor.tryParseMarkdownToBlocks(
          parsedValue.markdown as string,
        ),
      )
    : null;

  return {
    markdown:
      (parsedValue?.markdown as string | null) || convertedMarkdown,
    blocknote:
      (parsedValue?.blocknote as string | null) || convertedBlocknote,
  };
};
