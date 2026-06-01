import type { UIMessage } from 'ai';

// PORT-NOTE: twenty-shared/ai's isExtendedFileUIPart inlined below since the
// shared shim may not export it yet.

const CODE_INTERPRETER_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'text/plain',
  'text/xml',
  'application/xml',
]);

function isExtendedFileUIPart(
  part: Record<string, unknown>,
): part is { type: 'file'; mediaType: string; filename?: string; fileId: string } {
  return (
    typeof part === 'object' &&
    part !== null &&
    part.type === 'file' &&
    typeof part.fileId === 'string'
  );
}

export type ExtractedFile = {
  filename: string;
  fileId: string;
  mimeType: string;
};

export type ExtractCodeInterpreterFilesResult = {
  processedMessages: UIMessage[];
  extractedFiles: ExtractedFile[];
};

export const extractCodeInterpreterFiles = (
  messages: UIMessage[],
): ExtractCodeInterpreterFilesResult => {
  const extractedFiles: ExtractedFile[] = [];

  const processedMessages = messages.map((message) => {
    if (message.role !== 'user' || !message.parts) {
      return message;
    }

    const newParts: typeof message.parts = [];
    const filesForThisMessage: ExtractedFile[] = [];

    for (const part of message.parts) {
      if (isExtendedFileUIPart(part as Record<string, unknown>)) {
        const filePart = part as {
          type: 'file';
          mediaType: string;
          filename?: string;
          fileId: string;
        };
        const mimeType = filePart.mediaType ?? '';

        if (CODE_INTERPRETER_MIME_TYPES.has(mimeType)) {
          filesForThisMessage.push({
            filename: filePart.filename ?? 'uploaded_file',
            fileId: filePart.fileId,
            mimeType,
          });
        } else {
          newParts.push(part);
        }
      } else {
        newParts.push(part);
      }
    }

    if (filesForThisMessage.length > 0) {
      extractedFiles.push(...filesForThisMessage);

      const fileList = filesForThisMessage
        .map((f) => `- ${f.filename} (${f.mimeType})`)
        .join('\n');

      newParts.push({
        type: 'text',
        text: `\n\n[Files available for code interpreter at /home/user/:\n${fileList}]\n\nUse the code_interpreter tool to analyze these files.`,
      });
    }

    return {
      ...message,
      parts: newParts,
    };
  });

  return {
    processedMessages,
    extractedFiles,
  };
};
