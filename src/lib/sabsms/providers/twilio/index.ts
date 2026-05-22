import twilio from 'twilio';
import {
  SmsProvider,
  SendSmsOptions,
  SendSmsResult,
  InboundWebhookData,
  EstimatePriceOptions,
  PriceEstimate,
} from '../types';

export interface TwilioProviderConfig {
  accountSid: string;
  authToken: string;
  from?: string;
}

export class TwilioProvider implements SmsProvider {
  name = 'twilio';
  private client: twilio.Twilio;
  private config: TwilioProviderConfig;

  constructor(config: TwilioProviderConfig) {
    this.config = config;
    this.client = twilio(config.accountSid, config.authToken);
  }

  async send(options: SendSmsOptions): Promise<SendSmsResult> {
    const from = options.from || this.config.from;
    if (!from) {
      throw new Error('TwilioProvider: "from" number or sender ID is required.');
    }

    const message = await this.client.messages.create({
      to: options.to,
      from,
      body: options.body,
      mediaUrl: options.mediaUrls,
      statusCallback: options.statusCallbackUrl,
    });

    return {
      messageId: message.sid,
      status: this.mapStatus(message.status),
      provider: this.name,
      price: message.price || undefined,
      priceUnit: message.priceUnit || undefined,
      segments: message.numSegments ? parseInt(message.numSegments, 10) : undefined,
    };
  }

  async parseInboundWebhook(
    requestBody: any,
    headers: Record<string, string | string[] | undefined>
  ): Promise<InboundWebhookData> {
    return {
      messageId: requestBody.MessageSid || requestBody.SmsMessageSid,
      from: requestBody.From,
      to: requestBody.To,
      body: requestBody.Body,
      mediaUrls: requestBody.MediaUrl0 ? [requestBody.MediaUrl0] : undefined,
      provider: this.name,
      timestamp: new Date(),
      raw: requestBody,
    };
  }

  verifyWebhookSignature(
    requestBody: any,
    signature: string,
    url: string
  ): boolean {
    return twilio.validateRequest(this.config.authToken, signature, url, requestBody);
  }

  async estimatePrice(options: EstimatePriceOptions): Promise<PriceEstimate> {
    const isUnicode = /[^\u0000-\u007F]/.test(options.body);
    const charsPerSegment = isUnicode ? 70 : 160;
    const segments = Math.max(1, Math.ceil(options.body.length / charsPerSegment));
    
    const pricePerSegment = 0.0079;
    
    return {
      price: segments * pricePerSegment,
      currency: 'USD',
      segments,
    };
  }

  private mapStatus(twilioStatus: string): SendSmsResult['status'] {
    switch (twilioStatus) {
      case 'queued':
      case 'accepted':
      case 'scheduled':
      case 'sending':
        return 'queued';
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'undelivered':
        return 'undelivered';
      case 'failed':
      case 'canceled':
        return 'failed';
      default:
        return 'queued';
    }
  }
}
