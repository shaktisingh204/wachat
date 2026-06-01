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

// PORT-NOTE: SendEmailService (NestJS) is replaced by a plain interface.
// Callers supply a concrete implementation when constructing SendEmailTool.

export type SendResult = {
  messageId?: string;
  [key: string]: unknown;
};

export type ISendEmailService = {
  sendComposedEmail(data: ComposedEmail): Promise<SendResult>;
  persistSentMessage(
    sendResult: SendResult,
    data: ComposedEmail,
    workspaceId: string,
  ): Promise<void>;
};

export class SendEmailTool implements Tool {
  readonly description =
    "Send an email using a connected account. Requires SEND_EMAIL_TOOL permission.";
  readonly inputSchema = EmailToolInputZodSchema;

  constructor(
    private readonly emailComposerService: EmailComposerService,
    private readonly sendEmailService: ISendEmailService,
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

      const sendResult = await this.sendEmailService.sendComposedEmail(data);

      if (data.shouldPersistMessage) {
        await this.sendEmailService.persistSentMessage(
          sendResult,
          data,
          context.workspaceId,
        );
      }

      return {
        success: true,
        message: `Email sent successfully to ${data.toRecipientsDisplay}`,
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
          message: "Failed to send email",
          error: error.message,
        };
      }

      if (isInsufficientPermissionsError(error)) {
        return {
          success: false,
          message: "Failed to send email due to insufficient permissions",
          error:
            "The connected email account does not have permission to send emails. " +
            "The user should disconnect and reconnect their account in Settings > Accounts to grant the required permissions.",
        };
      }

      return {
        success: false,
        message: "Failed to send email",
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  }
}
