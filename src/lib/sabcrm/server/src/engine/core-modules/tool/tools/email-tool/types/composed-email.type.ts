// PORT-NOTE: ConnectedAccountEntity (TypeORM) and MessageAttachment are NestJS/
// TypeORM types. They are preserved here as plain structural types so the
// ComposedEmail contract is maintained without TypeORM dependencies.

export type ConnectedAccountSnapshot = {
  id: string;
  handle: string;
  provider: string;
  connectionParameters?: Record<string, unknown>;
  messageChannels?: Array<{
    id: string;
    handle: string;
    messageFolders?: unknown[];
  }>;
  [key: string]: unknown;
};

export type MessageAttachmentSnapshot = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type ComposedEmail = {
  recipients: { to: string[]; cc: string[]; bcc: string[] };
  toRecipientsDisplay: string;
  sanitizedSubject: string;
  plainTextBody: string;
  sanitizedHtmlBody: string;
  attachments: MessageAttachmentSnapshot[];
  connectedAccount: ConnectedAccountSnapshot;
  messageChannelId?: string;
  shouldPersistMessage: boolean;
  inReplyTo?: string;
  threadExternalId?: string;
  references?: string[];
};
