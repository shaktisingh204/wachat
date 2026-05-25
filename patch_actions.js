const fs = require('fs');
const file = 'src/app/actions/sabwa.actions.ts';
const content = fs.readFileSync(file, 'utf8');

const newActions = `
// ─── STATUSES ───────────────────────────────────────────────────────────────

export async function listMyStatuses(sessionId: IdLike): Promise<SabwaActionResult<any[]>> {
  try {
    const { auth } = await import('@/lib/crm-auth');
    const user = await auth();
    if (!user) throw new Error('Unauthorized');

    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    
    const sid = typeof sessionId === 'string' ? new (require('mongodb').ObjectId)(sessionId) : sessionId;
    
    const statuses = await db.collection('sabwa_statuses').find({
      projectId: user.projectId,
      sessionId: sid,
    }).sort({ ts: -1 }).toArray();

    return { ok: true, data: JSON.parse(JSON.stringify(statuses)) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function postMyStatus(sessionId: IdLike, data: any): Promise<SabwaActionResult<any>> {
  try {
    const { auth } = await import('@/lib/crm-auth');
    const user = await auth();
    if (!user) throw new Error('Unauthorized');

    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    
    const sid = typeof sessionId === 'string' ? new (require('mongodb').ObjectId)(sessionId) : sessionId;

    const doc = {
      projectId: user.projectId,
      sessionId: sid,
      kind: data.kind,
      body: data.body,
      bgColour: data.bgColour,
      mediaUrl: data.mediaUrl,
      mediaName: data.mediaName,
      audience: data.audience,
      viewers: [],
      reposters: [],
      ts: new Date(),
    };

    const res = await db.collection('sabwa_statuses').insertOne(doc);
    const newDoc = { ...doc, _id: res.insertedId };
    
    return { ok: true, data: JSON.parse(JSON.stringify(newDoc)) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
`;

fs.writeFileSync(file, content + newActions);
console.log('patched');
