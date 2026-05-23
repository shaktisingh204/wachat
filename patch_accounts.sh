cat << 'INNER_EOF' >> src/app/actions/crm-accounts.actions.ts

export async function getAccountNamesByIds(accountIds: string[]): Promise<Record<string, string>> {
    const session = await getSession();
    if (!session?.user || !accountIds.length) return {};
    const { db } = await connectToDatabase();
    const docs = await db.collection('crm_accounts').find({
        userId: new ObjectId(session.user._id),
        _id: { $in: accountIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) }
    }).project({ name: 1 }).toArray();
    
    const map: Record<string, string> = {};
    for (const d of docs) {
        map[d._id.toString()] = d.name || 'Client';
    }
    return map;
}
INNER_EOF
