/**
 * Shared types for the Client Portal — exported separately from the
 * server-action entry point so pages and components can import the
 * shapes without dragging in `'use server'`.
 */

export type ClientPortalKpis = {
    openTickets: number;
    unpaidInvoices: number;
    activeProjects: number;
    pendingEstimates: number;
};

export type ClientActivityItem = {
    type: 'ticket' | 'invoice' | 'estimate' | 'project' | 'contract';
    title: string;
    link: string;
    when: string;
};

export type ClientProject = {
    _id: string;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    progress: number;
    description?: string;
    managerName?: string;
    budget?: number;
    currency?: string;
};

export type ClientProjectTask = {
    _id: string;
    title: string;
    status: string;
    priority?: string;
    dueDate: string | null;
    assigneeName?: string;
};

export type ClientInvoice = {
    _id: string;
    invoiceNumber: string;
    invoiceDate: string | null;
    dueDate: string | null;
    total: number;
    paidAmount?: number;
    currency: string;
    status: string;
    publicHash?: string | null;
    lineItems?: Array<{ name?: string; quantity?: number; rate?: number; description?: string }>;
};

export type ClientEstimate = {
    _id: string;
    number: string;
    validTill: string | null;
    total: number;
    currency: string;
    status: string;
    publicHash?: string | null;
};

export type ClientContract = {
    _id: string;
    title: string;
    type?: string;
    value?: number;
    currency?: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    signedAt: string | null;
    publicHash?: string | null;
};

export type ClientTicket = {
    _id: string;
    number?: string;
    subject: string;
    status: string;
    priority: string;
    description?: string;
    lastReplyAt: string | null;
    createdAt: string | null;
};

export type ClientTicketReply = {
    _id: string;
    message: string;
    authorName: string;
    isStaff: boolean;
    createdAt: string | null;
};

export type ClientKbArticle = {
    _id: string;
    title: string;
    slug?: string;
    body?: string;
    category?: string;
    excerpt?: string;
    updatedAt: string | null;
};

export type ClientProfile = {
    _id: string;
    name: string;
    email: string;
    mobile?: string;
    company?: {
        companyName?: string;
        contactName?: string;
        country?: string;
        website?: string;
    };
};

export type ClientPortalBrand = {
    name: string;
    logo: string | null;
};
