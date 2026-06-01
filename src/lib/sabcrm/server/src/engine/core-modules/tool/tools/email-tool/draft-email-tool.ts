import "server-only";

import { FileFolder } from "@/lib/sabcrm/shared/src/types/FileFolder";

import { EmailComposerService } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/email-composer.service";
import { EmailToolInputZodSchema } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/email-tool.schema";
import { EmailToolException } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/exceptions/email-tool.exception";
import { isInsufficientPermissionsError } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/utils/is-insufficient-permissions-error.util";
import { type ComposedEmail } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/types/composed-email.type";
import { type EmailToolInput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/types/email-tool-input.type";
import { type ToolOutput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type";
import { type ToolExecutionContext } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-execution-context.type";
import { type Tool } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool.type";

// PORT-NOTE: MessagingMessageOutboundService (NestJS) is replaced by a plain
// interface. Callers supply a concrete implementation when constructing
// DraftEmailTool.

export type IDraftMessageOutboundService = {
  createDraft(
    params: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      html?: string;
      attachments: ComposedEmail["attachments"];
      inReplyTo?: string;
    },
    connectedAccount: ComposedEmail["connectedAccount"],
  ): Promise<void>;
};

export class DraftEmailTool implements Tool {
  readonly description =
    "Create a draft email using a connected account. The email will be saved as a draft, not sent.";
  readonly inputSchema = EmailToolInputZodSchema;

  constructor(
    private readonly emailComposerService: EmailComposerService,
    private readonly messageOutboundService: IDraftMessageOutboundService,
  ) {}

  async execute(
    parameters: EmailToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    try {
      const result = await this.emailComposerService.composeEmail(
        parameters,
        context,
        { attachmentsFileFolder: FileFolder.Workflow },
      );

      if (!result.success) {
        return result.output;
      }

      const { data } = result;

      await this.createDraft(data);

      return {
        success: true,
        message: `Draft created successfully for ${data.toRecipientsDisplay}`,
        result: {
          recipients: data.recipients.to,
          ccRecipients: data.recipients.cc,
          bccRecipients: data.recipients.bcc,
          subject: data.sanitizedSubject,
          connectedAccountId: data.connectedAccount.id,
          attachmentCount: data.attachments.length,
        },
      };
    } catch (error) {
      if (error instanceof EmailToolException) {
        return {
          success: false,
          message: "Failed to create draft",
          error: error.message,
        };
      }

      if (isInsufficientPermissionsError(error)) {
        return {
          success: false,
          message: "Failed to create draft due to insufficient permissions",
          error:
            "The connected email account does not have permission to create drafts. " +
            "The user should disconnect and reconnect their account in Settings > Accounts to grant the required permissions.",
        };
      }

      return {
        success: false,
        message: "Failed to create draft",
        error:
          error instanceof Error ? error.message : "Failed to create draft",
      };
    }
  }

  private async createDraft(data: ComposedEmail): Promise<void> {
    await this.messageOutboundService.createDraft(
      {
        to: data.recipients.to,
        cc: data.recipients.cc.length > 0 ? data.recipients.cc : undefined,
        bcc: data.recipients.bcc.length > 0 ? data.recipients.bcc : undefined,
        subject: data.sanitizedSubject,
        body: data.plainTextBody,
        html: data.sanitizedHtmlBody,
        attachments: data.attachments,
        inReplyTo: data.inReplyTo,
      },
      data.connectedAccount,
    );
  }
}
