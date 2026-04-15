
'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * SabFlow Connections Vault
 * Centralized credential storage in the sabflow_connections collection.
 * Supports all external app integrations.
 */

export type ConnectionType =
    | 'openai' | 'anthropic' | 'gemini'
    | 'slack' | 'discord' | 'telegram' | 'intercom'
    | 'stripe' | 'razorpay' | 'cashfree'
    | 'shopify' | 'woocommerce'
    | 'hubspot' | 'salesforce'
    | 'trello' | 'jira' | 'asana' | 'monday' | 'clickup'
    | 'github' | 'gitlab'
    | 'sendgrid' | 'mailchimp' | 'brevo'
    | 'twilio' | 'sms'
    | 'freshdesk' | 'zendesk'
    | 'notion'
    | 'google_sheets' | 'google_calendar' | 'google_drive' | 'google_docs'
    | 'postgresql' | 'mysql' | 'supabase'
    | 'airtable' | 'aws_s3' | 'cloudinary'
    | 'calcom'
    | 'custom';

export interface SabFlowConnection {
    _id?: ObjectId;
    userId: string;
    name: string;
    type: ConnectionType;
    credentials: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
    lastTestedAt?: Date;
    isValid?: boolean;
}

export interface ConnectionDefinition {
    type: ConnectionType;
    label: string;
    description: string;
    credentialFields: {
        name: string;
        label: string;
        type: 'text' | 'password' | 'url';
        required: boolean;
        placeholder?: string;
    }[];
}

export const CONNECTION_DEFINITIONS: ConnectionDefinition[] = [
    {
        type: 'openai',
        label: 'OpenAI',
        description: 'Connect to OpenAI for GPT models, DALL-E, and Whisper.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
        ],
    },
    {
        type: 'anthropic',
        label: 'Anthropic Claude',
        description: 'Connect to Anthropic for Claude AI models.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-ant-...' },
        ],
    },
    {
        type: 'gemini',
        label: 'Google Gemini',
        description: 'Connect to Google Gemini AI models.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true },
        ],
    },
    {
        type: 'slack',
        label: 'Slack',
        description: 'Connect to Slack for messaging and notifications.',
        credentialFields: [
            { name: 'botToken', label: 'Bot Token', type: 'password', required: true, placeholder: 'xoxb-...' },
        ],
    },
    {
        type: 'discord',
        label: 'Discord',
        description: 'Connect to Discord for messaging.',
        credentialFields: [
            { name: 'botToken', label: 'Bot Token', type: 'password', required: true },
            { name: 'guildId', label: 'Server ID (Guild ID)', type: 'text', required: false },
        ],
    },
    {
        type: 'telegram',
        label: 'Telegram',
        description: 'Connect to Telegram Bot API.',
        credentialFields: [
            { name: 'botToken', label: 'Bot Token', type: 'password', required: true, placeholder: '1234567890:ABC...' },
        ],
    },
    {
        type: 'stripe',
        label: 'Stripe',
        description: 'Connect to Stripe for payment processing.',
        credentialFields: [
            { name: 'secretKey', label: 'Secret Key', type: 'password', required: true, placeholder: 'sk_live_...' },
        ],
    },
    {
        type: 'razorpay',
        label: 'Razorpay',
        description: 'Connect to Razorpay for payment processing.',
        credentialFields: [
            { name: 'keyId', label: 'Key ID', type: 'text', required: true, placeholder: 'rzp_live_...' },
            { name: 'keySecret', label: 'Key Secret', type: 'password', required: true },
        ],
    },
    {
        type: 'cashfree',
        label: 'Cashfree',
        description: 'Connect to Cashfree Payments.',
        credentialFields: [
            { name: 'appId', label: 'App ID', type: 'text', required: true },
            { name: 'secretKey', label: 'Secret Key', type: 'password', required: true },
            { name: 'environment', label: 'Environment', type: 'text', required: false, placeholder: 'production or sandbox' },
        ],
    },
    {
        type: 'shopify',
        label: 'Shopify',
        description: 'Connect to a Shopify store.',
        credentialFields: [
            { name: 'shopDomain', label: 'Shop Domain', type: 'text', required: true, placeholder: 'mystore.myshopify.com' },
            { name: 'accessToken', label: 'Admin API Access Token', type: 'password', required: true },
        ],
    },
    {
        type: 'woocommerce',
        label: 'WooCommerce',
        description: 'Connect to a WooCommerce store.',
        credentialFields: [
            { name: 'storeUrl', label: 'Store URL', type: 'url', required: true, placeholder: 'https://mystore.com' },
            { name: 'consumerKey', label: 'Consumer Key', type: 'text', required: true, placeholder: 'ck_...' },
            { name: 'consumerSecret', label: 'Consumer Secret', type: 'password', required: true, placeholder: 'cs_...' },
        ],
    },
    {
        type: 'hubspot',
        label: 'HubSpot',
        description: 'Connect to HubSpot CRM.',
        credentialFields: [
            { name: 'accessToken', label: 'Access Token', type: 'password', required: true },
        ],
    },
    {
        type: 'trello',
        label: 'Trello',
        description: 'Connect to Trello for project management.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'text', required: true },
            { name: 'token', label: 'Token', type: 'password', required: true },
        ],
    },
    {
        type: 'jira',
        label: 'Jira',
        description: 'Connect to Jira for issue tracking.',
        credentialFields: [
            { name: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'mycompany (without .atlassian.net)' },
            { name: 'email', label: 'Email', type: 'text', required: true },
            { name: 'apiToken', label: 'API Token', type: 'password', required: true },
        ],
    },
    {
        type: 'asana',
        label: 'Asana',
        description: 'Connect to Asana for project management.',
        credentialFields: [
            { name: 'token', label: 'Personal Access Token', type: 'password', required: true },
        ],
    },
    {
        type: 'monday',
        label: 'Monday.com',
        description: 'Connect to Monday.com for project management.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true },
        ],
    },
    {
        type: 'clickup',
        label: 'ClickUp',
        description: 'Connect to ClickUp for project management.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true },
        ],
    },
    {
        type: 'github',
        label: 'GitHub',
        description: 'Connect to GitHub for repositories and issues.',
        credentialFields: [
            { name: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'ghp_...' },
        ],
    },
    {
        type: 'sendgrid',
        label: 'SendGrid',
        description: 'Connect to SendGrid for transactional email.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'SG.' },
        ],
    },
    {
        type: 'mailchimp',
        label: 'Mailchimp',
        description: 'Connect to Mailchimp for email marketing.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: '...us1' },
        ],
    },
    {
        type: 'brevo',
        label: 'Brevo (Sendinblue)',
        description: 'Connect to Brevo for email and SMS marketing.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true },
        ],
    },
    {
        type: 'twilio',
        label: 'Twilio',
        description: 'Connect to Twilio for SMS and voice.',
        credentialFields: [
            { name: 'accountSid', label: 'Account SID', type: 'text', required: true, placeholder: 'AC...' },
            { name: 'authToken', label: 'Auth Token', type: 'password', required: true },
        ],
    },
    {
        type: 'freshdesk',
        label: 'Freshdesk',
        description: 'Connect to Freshdesk for customer support.',
        credentialFields: [
            { name: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'mycompany (without .freshdesk.com)' },
            { name: 'apiKey', label: 'API Key', type: 'password', required: true },
        ],
    },
    {
        type: 'zendesk',
        label: 'Zendesk',
        description: 'Connect to Zendesk for customer support.',
        credentialFields: [
            { name: 'subdomain', label: 'Subdomain', type: 'text', required: true, placeholder: 'mycompany (without .zendesk.com)' },
            { name: 'email', label: 'Agent Email', type: 'text', required: true },
            { name: 'apiToken', label: 'API Token', type: 'password', required: true },
        ],
    },
    {
        type: 'intercom',
        label: 'Intercom',
        description: 'Connect to Intercom for customer messaging.',
        credentialFields: [
            { name: 'token', label: 'Access Token', type: 'password', required: true },
        ],
    },
    {
        type: 'notion',
        label: 'Notion',
        description: 'Connect to Notion for notes and databases.',
        credentialFields: [
            { name: 'token', label: 'Internal Integration Token', type: 'password', required: true, placeholder: 'secret_...' },
        ],
    },
    {
        type: 'google_sheets',
        label: 'Google Sheets',
        description: 'Connect to Google Sheets.',
        credentialFields: [
            { name: 'accessToken', label: 'OAuth Access Token', type: 'password', required: true },
            { name: 'refreshToken', label: 'OAuth Refresh Token', type: 'password', required: false },
        ],
    },
    {
        type: 'google_calendar',
        label: 'Google Calendar',
        description: 'Connect to Google Calendar.',
        credentialFields: [
            { name: 'accessToken', label: 'OAuth Access Token', type: 'password', required: true },
            { name: 'refreshToken', label: 'OAuth Refresh Token', type: 'password', required: false },
        ],
    },
    {
        type: 'google_drive',
        label: 'Google Drive',
        description: 'Connect to Google Drive.',
        credentialFields: [
            { name: 'accessToken', label: 'OAuth Access Token', type: 'password', required: true },
            { name: 'refreshToken', label: 'OAuth Refresh Token', type: 'password', required: false },
        ],
    },
    {
        type: 'google_docs',
        label: 'Google Docs',
        description: 'Connect to Google Docs.',
        credentialFields: [
            { name: 'accessToken', label: 'OAuth Access Token', type: 'password', required: true },
            { name: 'refreshToken', label: 'OAuth Refresh Token', type: 'password', required: false },
        ],
    },
    {
        type: 'postgresql',
        label: 'PostgreSQL',
        description: 'Connect to a PostgreSQL database.',
        credentialFields: [
            { name: 'connectionString', label: 'Connection String', type: 'password', required: false, placeholder: 'postgresql://user:pass@host:5432/db' },
            { name: 'host', label: 'Host', type: 'text', required: false },
            { name: 'port', label: 'Port', type: 'text', required: false, placeholder: '5432' },
            { name: 'database', label: 'Database', type: 'text', required: false },
            { name: 'user', label: 'User', type: 'text', required: false },
            { name: 'password', label: 'Password', type: 'password', required: false },
        ],
    },
    {
        type: 'mysql',
        label: 'MySQL',
        description: 'Connect to a MySQL database.',
        credentialFields: [
            { name: 'host', label: 'Host', type: 'text', required: true },
            { name: 'port', label: 'Port', type: 'text', required: false, placeholder: '3306' },
            { name: 'database', label: 'Database', type: 'text', required: true },
            { name: 'user', label: 'User', type: 'text', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true },
        ],
    },
    {
        type: 'supabase',
        label: 'Supabase',
        description: 'Connect to a Supabase project.',
        credentialFields: [
            { name: 'projectUrl', label: 'Project URL', type: 'url', required: true, placeholder: 'https://xxx.supabase.co' },
            { name: 'anonKey', label: 'Anon Key', type: 'password', required: true },
            { name: 'serviceRoleKey', label: 'Service Role Key', type: 'password', required: false },
        ],
    },
    {
        type: 'airtable',
        label: 'Airtable',
        description: 'Connect to Airtable databases.',
        credentialFields: [
            { name: 'token', label: 'Personal Access Token', type: 'password', required: true },
        ],
    },
    {
        type: 'aws_s3',
        label: 'AWS S3',
        description: 'Connect to Amazon S3 for file storage.',
        credentialFields: [
            { name: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
            { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
            { name: 'region', label: 'Region', type: 'text', required: false, placeholder: 'us-east-1' },
        ],
    },
    {
        type: 'cloudinary',
        label: 'Cloudinary',
        description: 'Connect to Cloudinary for media management.',
        credentialFields: [
            { name: 'cloudName', label: 'Cloud Name', type: 'text', required: true },
            { name: 'apiKey', label: 'API Key', type: 'text', required: true },
            { name: 'apiSecret', label: 'API Secret', type: 'password', required: true },
        ],
    },
    {
        type: 'calcom',
        label: 'Cal.com',
        description: 'Connect to Cal.com for scheduling.',
        credentialFields: [
            { name: 'apiKey', label: 'API Key', type: 'password', required: true },
        ],
    },
];

// CRUD operations for connections

export async function listConnections(userId: string): Promise<SabFlowConnection[]> {
    const { db } = await connectToDatabase();
    const connections = await db
        .collection('sabflow_connections')
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();
    // Mask credential values before returning
    return connections.map(c => ({
        ...c,
        credentials: maskCredentials(c.credentials),
    })) as SabFlowConnection[];
}

export async function getConnection(connectionId: string, userId: string): Promise<SabFlowConnection | null> {
    const { db } = await connectToDatabase();
    const connection = await db.collection('sabflow_connections').findOne({
        _id: new ObjectId(connectionId),
        userId,
    });
    return connection as SabFlowConnection | null;
}

export async function createConnection(
    userId: string,
    name: string,
    type: ConnectionType,
    credentials: Record<string, string>
): Promise<{ id: string }> {
    const { db } = await connectToDatabase();
    const now = new Date();
    const result = await db.collection('sabflow_connections').insertOne({
        userId,
        name,
        type,
        credentials,
        createdAt: now,
        updatedAt: now,
    });
    return { id: result.insertedId.toString() };
}

export async function updateConnection(
    connectionId: string,
    userId: string,
    updates: Partial<Pick<SabFlowConnection, 'name' | 'credentials'>>
): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db.collection('sabflow_connections').updateOne(
        { _id: new ObjectId(connectionId), userId },
        { $set: { ...updates, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
}

export async function deleteConnection(connectionId: string, userId: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db.collection('sabflow_connections').deleteOne({
        _id: new ObjectId(connectionId),
        userId,
    });
    return result.deletedCount > 0;
}

/**
 * Get credentials for a specific connection (full, unmasked).
 * Only used server-side during flow execution.
 */
export async function getConnectionCredentials(
    connectionId: string,
    userId: string
): Promise<Record<string, string> | null> {
    const connection = await getConnection(connectionId, userId);
    return connection?.credentials ?? null;
}

/**
 * Find a connection by type for a user (returns first match).
 */
export async function findConnectionByType(
    userId: string,
    type: ConnectionType
): Promise<SabFlowConnection | null> {
    const { db } = await connectToDatabase();
    const connection = await db.collection('sabflow_connections').findOne({ userId, type });
    return connection as SabFlowConnection | null;
}

/**
 * Mask sensitive credential values for display (show only last 4 chars).
 */
function maskCredentials(credentials: Record<string, string>): Record<string, string> {
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
        const sensitiveKeys = ['apiKey', 'secretKey', 'authToken', 'accessToken', 'token', 'password', 'secret', 'apiSecret', 'keySecret', 'serviceRoleKey', 'refreshToken'];
        const isSensitive = sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()));
        if (isSensitive && value.length > 8) {
            masked[key] = '••••••••' + value.slice(-4);
        } else {
            masked[key] = value;
        }
    }
    return masked;
}
