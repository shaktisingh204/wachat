/**
 * Mongo doc → portal-shaped object mappers. Kept in `/lib` so the
 * actions file can stay focused on session checks and IO orchestration.
 */

import 'server-only';

import type { ObjectId, Document } from 'mongodb';

import { asNumber, asString, toIso } from './db';
import type {
    ClientContract,
    ClientEstimate,
    ClientInvoice,
    ClientKbArticle,
    ClientProject,
    ClientTicket,
} from './types';

export function mapProject(doc: Document): ClientProject {
    return {
        _id: String((doc as { _id: ObjectId })._id),
        name: asString((doc as { name?: string }).name) || 'Untitled project',
        status: asString((doc as { status?: string }).status) || 'planning',
        startDate: toIso((doc as { startDate?: Date }).startDate),
        endDate: toIso((doc as { endDate?: Date }).endDate),
        progress: asNumber((doc as { progress?: number }).progress),
        description: (doc as { description?: string }).description,
        managerName: (doc as { managerName?: string }).managerName,
        budget: (doc as { budget?: number }).budget,
        currency: (doc as { currency?: string }).currency,
    };
}

export function mapInvoice(doc: Document): ClientInvoice {
    const d = doc as {
        _id: ObjectId;
        invoiceNumber?: string;
        invoiceDate?: Date;
        dueDate?: Date;
        total?: number;
        paidAmount?: number;
        currency?: string;
        status?: string;
        publicHash?: string;
        lineItems?: Array<{
            name?: string;
            quantity?: number;
            rate?: number;
            description?: string;
        }>;
    };
    return {
        _id: String(d._id),
        invoiceNumber: asString(d.invoiceNumber) || String(d._id).slice(-6).toUpperCase(),
        invoiceDate: toIso(d.invoiceDate),
        dueDate: toIso(d.dueDate),
        total: asNumber(d.total),
        paidAmount: asNumber(d.paidAmount),
        currency: asString(d.currency) || 'USD',
        status: asString(d.status) || 'Draft',
        publicHash: d.publicHash ?? null,
        lineItems: d.lineItems ?? [],
    };
}

export function mapEstimate(doc: Document): ClientEstimate {
    const d = doc as {
        _id: ObjectId;
        number?: string;
        estimateNumber?: string;
        validTill?: Date;
        validTillDate?: Date;
        total?: number;
        currency?: string;
        status?: string;
        publicHash?: string;
    };
    return {
        _id: String(d._id),
        number: asString(d.number ?? d.estimateNumber) || String(d._id).slice(-6).toUpperCase(),
        validTill: toIso(d.validTill ?? d.validTillDate),
        total: asNumber(d.total),
        currency: asString(d.currency) || 'USD',
        status: asString(d.status) || 'waiting',
        publicHash: d.publicHash ?? null,
    };
}

export function mapContract(doc: Document): ClientContract {
    const d = doc as {
        _id: ObjectId;
        title?: string;
        contractType?: string;
        type?: string;
        value?: number;
        currency?: string;
        startDate?: Date;
        endDate?: Date;
        status?: string;
        signedAt?: Date;
        publicHash?: string;
    };
    return {
        _id: String(d._id),
        title: asString(d.title) || 'Contract',
        type: d.contractType ?? d.type,
        value: d.value,
        currency: d.currency,
        startDate: toIso(d.startDate),
        endDate: toIso(d.endDate),
        status: asString(d.status) || 'draft',
        signedAt: toIso(d.signedAt),
        publicHash: d.publicHash ?? null,
    };
}

export function mapTicket(doc: Document): ClientTicket {
    const d = doc as {
        _id: ObjectId;
        ticketNumber?: string;
        number?: string;
        subject?: string;
        status?: string;
        priority?: string;
        description?: string;
        lastReplyAt?: Date;
        updatedAt?: Date;
        createdAt?: Date;
        dueBy?: Date;
    };
    return {
        _id: String(d._id),
        number: d.ticketNumber ?? d.number,
        subject: asString(d.subject) || 'Untitled ticket',
        status: asString(d.status) || 'open',
        priority: asString(d.priority) || 'medium',
        description: d.description,
        lastReplyAt: toIso(d.lastReplyAt ?? d.updatedAt),
        createdAt: toIso(d.createdAt),
        dueBy: toIso(d.dueBy),
    };
}

export function mapArticle(doc: Document): ClientKbArticle {
    const d = doc as {
        _id: ObjectId;
        title?: string;
        slug?: string;
        body?: string;
        category?: string;
        excerpt?: string;
        summary?: string;
        updatedAt?: Date;
    };
    return {
        _id: String(d._id),
        title: asString(d.title) || 'Untitled',
        slug: d.slug,
        body: d.body,
        category: d.category,
        excerpt: d.excerpt ?? d.summary,
        updatedAt: toIso(d.updatedAt),
    };
}
