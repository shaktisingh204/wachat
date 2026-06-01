import "server-only";

import { z } from "zod";

import { MAX_EMAIL_RECIPIENTS } from "@/lib/sabcrm/shared/src/constants/MaxEmailRecipients";
import { type EmailAttachment } from "@/lib/sabcrm/shared/src/types/EmailAttachment";
import { FileFolder } from "@/lib/sabcrm/shared/src/types/FileFolder";
import { ConnectedAccountProvider } from "@/lib/sabcrm/shared/src/types/ConnectedAccountProvider";

import {
  EmailToolException,
  EmailToolExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/exceptions/email-tool.exception";
import { type ComposeEmailParams } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/types/compose-email-params.type";
import { type EmailComposerResult } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/types/email-composer-result.type";
import {
  type ComposedEmail,
  type ConnectedAccountSnapshot,
  type MessageAttachmentSnapshot,
} from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/types/composed-email.type";
import { parseCommaSeparatedEmails } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/utils/parse-comma-separated-emails.util";
import { type ToolExecutionContext } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-execution-context.type";

// PORT-NOTE: NestJS @Injectable() / DI removed. TypeORM repositories are
// replaced by interface contracts — callers supply concrete implementations.
// GlobalWorkspaceOrmManager, InjectWorkspaceScopedRepository, and
// buildSystemAuthContext are not available in SabNode; the connected-account
// and file lookups are surfaced as injectable functions below.

export type ConnectedAccountWithChannels = ConnectedAccountSnapshot & {
  messageChannels: Array<{
    id: string;
    handle: string;
    messageFolders?: unknown[];
  }>;
};

export type ParentThreadContext = {
  threadExternalId?: string;
  references?: string[];
};

export type IEmailComposerConnectedAccountRepo = {
  findById(
    id: string,
    workspaceId: string,
  ): Promise<ConnectedAccountWithChannels | null>;
  findFirst(workspaceId: string): Promise<{ id: string } | null>;
};

export type IEmailComposerFileRepo = {
  findByIds(
    ids: string[],
    workspaceId: string,
  ): Promise<Array<{ id: string; mimeType?: string }>>;
  getStream(params: {
    fileId: string;
    workspaceId: string;
    fileFolder: FileFolder;
  }): Promise<{ stream: NodeJS.ReadableStream } | null>;
};

export type IEmailComposerMessageRepo = {
  getParentThreadContext(
    workspaceId: string,
    inReplyTo: string,
    messageChannelId: string,
  ): Promise<ParentThreadContext>;
};

export type EmailComposerServiceDeps = {
  connectedAccountRepo: IEmailComposerConnectedAccountRepo;
  fileRepo: IEmailComposerFileRepo;
  messageRepo?: IEmailComposerMessageRepo;
};

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export class EmailComposerService {
  constructor(private readonly deps: EmailComposerServiceDeps) {}

  private async getConnectedAccount(
    connectedAccountId: string,
    workspaceId: string,
  ): Promise<ConnectedAccountWithChannels> {
    if (!isValidUuid(connectedAccountId)) {
      throw new EmailToolException(
        `Connected Account ID is not a valid UUID`,
        EmailToolExceptionCode.INVALID_CONNECTED_ACCOUNT_ID,
      );
    }

    const connectedAccount = await this.deps.connectedAccountRepo.findById(
      connectedAccountId,
      workspaceId,
    );

    if (!isDefined(connectedAccount)) {
      throw new EmailToolException(
        `Connected Account '${connectedAccountId}' not found`,
        EmailToolExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND,
      );
    }

    return connectedAccount;
  }

  private async getOrThrowFirstConnectedAccountId(
    workspaceId: string,
  ): Promise<string> {
    const first = await this.deps.connectedAccountRepo.findFirst(workspaceId);

    if (!isDefined(first)) {
      throw new EmailToolException(
        "No connected accounts found for this workspace",
        EmailToolExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND,
      );
    }

    return first.id;
  }

  private normalizeRecipients(parameters: ComposeEmailParams): {
    to: string[];
    cc: string[];
    bcc: string[];
  } {
    if (
      !parameters.recipients ||
      !parameters.recipients.to ||
      parameters.recipients.to.trim().length === 0
    ) {
      throw new EmailToolException(
        "No recipients specified",
        EmailToolExceptionCode.INVALID_EMAIL,
      );
    }

    const to = parseCommaSeparatedEmails(parameters.recipients.to);

    if (to.length === 0) {
      throw new EmailToolException(
        "No valid recipients specified",
        EmailToolExceptionCode.INVALID_EMAIL,
      );
    }

    return {
      to,
      cc: parseCommaSeparatedEmails(parameters.recipients.cc),
      bcc: parseCommaSeparatedEmails(parameters.recipients.bcc),
    };
  }

  private validateEmails(recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
  }): string[] {
    const emailSchema = z.string().trim().pipe(z.email());
    const invalidEmails: string[] = [];
    const allEmails = [...recipients.to, ...recipients.cc, ...recipients.bcc];

    for (const email of allEmails) {
      const result = emailSchema.safeParse(email);
      if (!result.success) {
        invalidEmails.push(email);
      }
    }

    return invalidEmails;
  }

  private assertRecipientCountWithinLimit(recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
  }): void {
    const total =
      recipients.to.length + recipients.cc.length + recipients.bcc.length;

    if (total > MAX_EMAIL_RECIPIENTS) {
      throw new EmailToolException(
        `Too many recipients: ${total}. Maximum allowed is ${MAX_EMAIL_RECIPIENTS}.`,
        EmailToolExceptionCode.TOO_MANY_RECIPIENTS,
      );
    }
  }

  private async getAttachments(
    files: Array<EmailAttachment>,
    workspaceId: string,
    fileFolder: FileFolder,
  ): Promise<MessageAttachmentSnapshot[]> {
    if (files.length === 0) {
      return [];
    }

    const fileIds = files.map((file) => file.id);
    const fileEntities = await this.deps.fileRepo.findByIds(
      fileIds,
      workspaceId,
    );

    const fileEntityMap = new Map(
      fileEntities.map((entity) => [entity.id, entity]),
    );

    const filesNotFound: string[] = [];
    for (const fileMetadata of files) {
      if (!fileEntityMap.has(fileMetadata.id)) {
        filesNotFound.push(`${fileMetadata.name} (${fileMetadata.id})`);
      }
    }

    if (filesNotFound.length > 0) {
      throw new EmailToolException(
        `Files not found: ${filesNotFound.join(", ")}`,
        EmailToolExceptionCode.FILE_NOT_FOUND,
      );
    }

    const attachments: MessageAttachmentSnapshot[] = [];

    for (const fileMetadata of files) {
      const fileEntity = fileEntityMap.get(fileMetadata.id);

      const fileStream = await this.deps.fileRepo.getStream({
        fileId: fileMetadata.id,
        workspaceId,
        fileFolder,
      });

      if (fileStream === null) {
        throw new EmailToolException(
          `Files not found: ${fileMetadata.name} (${fileMetadata.id})`,
          EmailToolExceptionCode.FILE_NOT_FOUND,
        );
      }

      const buffer = await streamToBuffer(fileStream.stream);

      attachments.push({
        filename: fileMetadata.name,
        content: buffer,
        contentType: fileEntity?.mimeType ?? "application/octet-stream",
      });
    }

    return attachments;
  }

  async composeEmail(
    parameters: ComposeEmailParams,
    context: ToolExecutionContext,
    options: { attachmentsFileFolder: FileFolder },
  ): Promise<EmailComposerResult> {
    const { workspaceId } = context;
    const { subject, body, files, inReplyTo } = parameters;
    let { connectedAccountId } = parameters;

    let recipients: { to: string[]; cc: string[]; bcc: string[] };

    try {
      recipients = this.normalizeRecipients(parameters);
      this.assertRecipientCountWithinLimit(recipients);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Invalid recipients";

      return {
        success: false,
        output: {
          success: false,
          message: errorMessage,
          error: errorMessage,
        },
      };
    }

    const invalidEmails = this.validateEmails(recipients);

    if (invalidEmails.length > 0) {
      return {
        success: false,
        output: {
          success: false,
          message: `Invalid email addresses: ${invalidEmails.join(", ")}`,
          error: `Invalid email addresses: ${invalidEmails.join(", ")}`,
        },
      };
    }

    const toRecipientsDisplay = recipients.to.join(", ");

    if (!connectedAccountId) {
      connectedAccountId =
        await this.getOrThrowFirstConnectedAccountId(workspaceId);
    }

    const connectedAccount = await this.getConnectedAccount(
      connectedAccountId,
      workspaceId,
    );

    const messageChannel = connectedAccount.messageChannels.find(
      (channel) => channel.handle === connectedAccount.handle,
    );

    const isSmtpOnlyAccount =
      connectedAccount.provider === ConnectedAccountProvider.IMAP_SMTP_CALDAV &&
      !isDefined(
        (connectedAccount.connectionParameters as Record<string, unknown>)
          ?.IMAP,
      );

    if (
      isSmtpOnlyAccount &&
      !isDefined(
        (connectedAccount.connectionParameters as Record<string, unknown>)
          ?.SMTP,
      )
    ) {
      throw new EmailToolException(
        `SMTP is not configured for connected account '${connectedAccountId}'`,
        EmailToolExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND,
      );
    }

    if (!isSmtpOnlyAccount && !isDefined(messageChannel)) {
      throw new EmailToolException(
        `No message channel found for connected account '${connectedAccountId}'`,
        EmailToolExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND,
      );
    }

    const attachments = await this.getAttachments(
      files || [],
      workspaceId,
      options.attachmentsFileFolder,
    );

    // PORT-NOTE: DOMPurify + jsdom are optional peer dependencies. Install them
    // if HTML sanitization is needed in the SabNode environment.
    let sanitizedHtmlBody = body || "";
    let plainTextBody = "";
    let sanitizedSubject = subject || "";

    try {
      const { JSDOM } = await import("jsdom");
      const DOMPurify = (await import("dompurify")).default;
      const { toPlainText } = await import("@react-email/render");
      const window = new JSDOM("").window;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const purify = DOMPurify(window as any);
      sanitizedHtmlBody = purify.sanitize(body || "");
      plainTextBody = toPlainText(sanitizedHtmlBody);
      sanitizedSubject = purify.sanitize(subject || "");
    } catch {
      // DOMPurify / jsdom not installed — use raw values (safe only in trusted contexts)
      plainTextBody = (body || "").replace(/<[^>]*>/g, "");
    }

    let threadExternalId: string | undefined;
    let references: string[] | undefined;

    if (
      isDefined(inReplyTo) &&
      isDefined(messageChannel) &&
      this.deps.messageRepo
    ) {
      const parentCtx = await this.deps.messageRepo.getParentThreadContext(
        workspaceId,
        inReplyTo,
        messageChannel.id,
      );
      threadExternalId = parentCtx.threadExternalId;
      references = parentCtx.references;
    }

    const composedEmail: ComposedEmail = {
      recipients,
      toRecipientsDisplay,
      sanitizedSubject,
      plainTextBody,
      sanitizedHtmlBody,
      attachments,
      connectedAccount,
      messageChannelId: messageChannel?.id,
      shouldPersistMessage: isDefined(messageChannel),
      inReplyTo,
      threadExternalId,
      references,
    };

    return { success: true, data: composedEmail };
  }
}
