export interface SendSmsOptions {
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
  statusCallbackUrl?: string;
}

export interface SendSmsResult {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  provider: string;
  price?: string;
  priceUnit?: string;
  segments?: number;
}

export interface InboundWebhookData {
  messageId: string;
  from: string;
  to: string;
  body: string;
  mediaUrls?: string[];
  provider: string;
  timestamp: Date;
  raw: any;
}

export interface EstimatePriceOptions {
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
}

export interface PriceEstimate {
  price: number;
  currency: string;
  segments: number;
}

export interface SmsProvider {
  name: string;

  /**
   * Send an SMS message
   */
  send(options: SendSmsOptions): Promise<SendSmsResult>;

  /**
   * Parse an incoming webhook into a standard format
   */
  parseInboundWebhook(
    requestBody: any,
    headers: Record<string, string | string[] | undefined>
  ): Promise<InboundWebhookData>;

  /**
   * Verify the signature of an incoming webhook
   */
  verifyWebhookSignature(
    requestBody: string | Buffer,
    signature: string,
    url: string
  ): boolean;

  /**
   * Estimate the price and segment count for a message
   */
  estimatePrice(options: EstimatePriceOptions): Promise<PriceEstimate>;
}
