export async function getAssetAssignmentsByAssetId(assetId: string, excludeId?: string): Promise<CrmAssetAssignmentDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const query: any = {
            userId: new ObjectId(session.user._id as string),
            asset_id: assetId
        };
        if (excludeId && ObjectId.isValid(excludeId)) {
            query._id = { $ne: new ObjectId(excludeId) };
        }
        const rows = await db.collection(COLLECTION).find(query).sort({ assigned_at: -1 }).toArray();
        return rows.map(r => ({ ...r, _id: r._id.toString() })) as unknown as CrmAssetAssignmentDoc[];
    } catch (e) {
        console.error('[getAssetAssignmentsByAssetId] failed:', e);
        return [];
    }
}
