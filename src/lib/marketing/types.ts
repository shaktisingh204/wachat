export interface UtmLink {
  id: string;
  url: string;
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
  clicks: number;
  createdAt: Date;
}

export interface WhatsappBot {
  id: string;
  name: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LandingPage {
  id: string;
  title: string;
  slug: string;
  htmlContent: string;
  isPublished: boolean;
  views: number;
  conversions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InboxMessage {
  id: string;
  channel: 'email' | 'whatsapp' | 'facebook' | 'instagram' | 'telegram';
  senderId: string;
  content: string;
  isRead: boolean;
  timestamp: Date;
}

export interface AbTest {
  id: string;
  experimentName: string;
  variants: string[];
  winningVariantId?: string;
  status: 'running' | 'completed' | 'draft';
  createdAt: Date;
}

export interface AudienceSegment {
  id: string;
  name: string;
  rules: any[]; // JSON array of rules
  contactCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AbandonedCart {
  id: string;
  userId: string;
  items: any[];
  totalAmount: number;
  recovered: boolean;
  abandonedAt: Date;
}

export interface SocialPost {
  id: string;
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin';
  content: string;
  scheduledTime: Date;
  status: 'scheduled' | 'published' | 'failed';
  createdAt: Date;
}

export interface Affiliate {
  id: string;
  name: string;
  code: string;
  commissionRate: number;
  earnings: number;
  joinedAt: Date;
}
