
'use server';

import { getSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { EcommProduct, EcommOrder, EcommShopSettings } from '@/lib/definitions';
import { ObjectId } from 'mongodb';

export async function getEcommProducts(shopId: string) {
    // TODO: Implement
    return [];
}

export async function getEcommOrders(shopId: string) {
    // TODO: Implement
    return [];
}

export async function getEcommShopSettings(projectId: string) {
    // TODO: Implement
    return null;
}
