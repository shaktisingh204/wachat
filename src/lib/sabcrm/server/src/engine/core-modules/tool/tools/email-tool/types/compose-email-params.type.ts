import { type EmailAttachment } from "@/lib/sabcrm/shared/src/types/EmailAttachment";

export type ComposeEmailParams = {
  recipients: {
    to: string;
    cc?: string;
    bcc?: string;
  };
  subject: string;
  body: string;
  connectedAccountId?: string;
  files?: Array<EmailAttachment>;
  inReplyTo?: string;
};
