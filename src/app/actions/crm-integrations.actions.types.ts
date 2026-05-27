/**
 * Types extracted from crm-integrations.actions.ts
 * to avoid Turbopack 'use server' export restrictions.
 */

export type IntegrationStatus = {
    shopify: IntegrationStatusData;
    zapier: IntegrationStatusData;
    mailchimp: IntegrationStatusData;
    slack: IntegrationStatusData;
    gmail: IntegrationStatusData;
    whatsapp: IntegrationStatusData;
    facebook: IntegrationStatusData;
};
