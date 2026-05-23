'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function lookupProductByBarcode(barcode: string) {
    const session = await getSession();
    if (!session?.user?._id) return null;
    
    const { db } = await connectToDatabase();
    
    const product = await db.collection('crm_inventory_items').findOne({
        userId: new ObjectId(session.user._id),
        $or: [
            { sku: barcode },
            { barcode: barcode },
            { name: barcode }
        ]
    });
    
    if (!product) return null;
    
    return {
        _id: String(product._id),
        name: product.name,
        sku: product.sku,
        cost: product.costPrice || product.price || 0
    };
}
