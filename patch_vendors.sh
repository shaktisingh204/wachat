cat << 'INNER_EOF' >> src/app/actions/crm-vendors.actions.ts

export async function getVendorNamesByIds(vendorIds: string[]): Promise<Record<string, string>> {
    const session = await getSession();
    if (!session?.user || !vendorIds.length) return {};
    const { db } = await connectToDatabase();
    const docs = await db.collection('crm_vendors').find({
        userId: new ObjectId(session.user._id),
        _id: { $in: vendorIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) }
    }).project({ name: 1, displayName: 1 }).toArray();
    
    const map: Record<string, string> = {};
    for (const d of docs) {
        map[d._id.toString()] = d.displayName || d.name || 'Vendor';
    }
    return map;
}
INNER_EOF
