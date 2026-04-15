import {
  FileText, Shield, Mail, Cloud, Bot, Users, Bell, CreditCard, Users2,
  TrendingUp, Database, Phone, BarChart2, Webhook, Receipt, Layout,
  Activity, Zap,
} from 'lucide-react';

export const iconBatch08: Record<string, { icon: any; iconColor: string }> = {
  // notion
  'notion': { icon: FileText, iconColor: 'text-gray-700' },
  'notion-ai': { icon: FileText, iconColor: 'text-gray-700' },
  'notion-enhanced': { icon: FileText, iconColor: 'text-gray-700' },

  // okta
  'okta': { icon: Shield, iconColor: 'text-blue-500' },
  'okta-enhanced': { icon: Shield, iconColor: 'text-blue-500' },

  // omnisend
  'omnisend': { icon: Mail, iconColor: 'text-blue-500' },

  // onedrive
  'onedrive': { icon: Cloud, iconColor: 'text-blue-600' },
  'onedrive-enhanced': { icon: Cloud, iconColor: 'text-blue-600' },

  // openai
  'openai': { icon: Bot, iconColor: 'text-teal-500' },
  'openai-assistants': { icon: Bot, iconColor: 'text-teal-500' },
  'openai-enhanced': { icon: Bot, iconColor: 'text-teal-500' },

  // orbit
  'orbit': { icon: Users, iconColor: 'text-purple-500' },

  // pagerduty
  'pagerduty': { icon: Bell, iconColor: 'text-red-500' },
  'pagerduty-enhanced': { icon: Bell, iconColor: 'text-red-500' },

  // pandadoc
  'pandadoc-enhanced': { icon: FileText, iconColor: 'text-teal-500' },

  // paypal
  'paypal': { icon: CreditCard, iconColor: 'text-blue-600' },
  'paypal-enhanced': { icon: CreditCard, iconColor: 'text-blue-600' },

  // paystack
  'paystack': { icon: CreditCard, iconColor: 'text-blue-500' },

  // personio
  'personio': { icon: Users2, iconColor: 'text-teal-500' },

  // pinecone
  'pinecone': { icon: Database, iconColor: 'text-indigo-500' },
  'pinecone-enhanced': { icon: Database, iconColor: 'text-indigo-500' },

  // pipedrive
  'pipedrive': { icon: TrendingUp, iconColor: 'text-green-500' },
  'pipedrive-enhanced': { icon: TrendingUp, iconColor: 'text-green-500' },

  // plaid
  'plaid': { icon: CreditCard, iconColor: 'text-teal-500' },
  'plaid-enhanced': { icon: CreditCard, iconColor: 'text-teal-500' },

  // planetscale
  'planetscale': { icon: Database, iconColor: 'text-purple-500' },

  // plivo
  'plivo': { icon: Phone, iconColor: 'text-green-500' },
  'plivo-enhanced': { icon: Phone, iconColor: 'text-green-500' },

  // postmark
  'postmark': { icon: Mail, iconColor: 'text-yellow-600' },
  'postmark-enhanced': { icon: Mail, iconColor: 'text-yellow-600' },

  // postgres / postgresql
  'postgres-api': { icon: Database, iconColor: 'text-blue-500' },
  'postgresql': { icon: Database, iconColor: 'text-blue-500' },

  // posthog
  'posthog': { icon: BarChart2, iconColor: 'text-orange-500' },
  'posthog-enhanced': { icon: BarChart2, iconColor: 'text-orange-500' },
  'posthog-v2': { icon: BarChart2, iconColor: 'text-orange-500' },

  // prometheus
  'prometheus': { icon: Activity, iconColor: 'text-orange-500' },

  // quickbooks
  'quickbooks': { icon: Receipt, iconColor: 'text-green-500' },
  'quickbooks-enhanced': { icon: Receipt, iconColor: 'text-green-500' },
  'quickbooks-payments': { icon: Receipt, iconColor: 'text-green-500' },

  // razorpay
  'razorpay-enhanced': { icon: CreditCard, iconColor: 'text-blue-500' },

  // redis
  'redis': { icon: Database, iconColor: 'text-red-500' },
  'redis-enhanced': { icon: Database, iconColor: 'text-red-500' },

  // replicate
  'replicate': { icon: Bot, iconColor: 'text-gray-600' },
  'replicate-enhanced': { icon: Bot, iconColor: 'text-gray-600' },

  // retool
  'retool': { icon: Layout, iconColor: 'text-blue-500' },

  // ringcentral
  'ringcentral': { icon: Phone, iconColor: 'text-blue-500' },
};
