const fs = require('fs');
const path = './src/app/actions/two-fa.actions.ts';
let code = fs.readFileSync(path, 'utf8');

const newCode = `
export interface LoginAttempt {
  _id: string;
  ip: string;
  userAgent: string;
  status: 'success' | 'failed' | 'pending_2fa';
  createdAt: Date;
}

export async function getRecentLoginAttempts(): Promise<ActionResult<LoginAttempt[]>> {
  const ctx = await requireUserOid();
  if (!ctx) return { ok: false, error: 'Unauthorized.' };
  const { db } = await connectToDatabase();
  const attempts = await db.collection('login_attempts')
    .find({ userId: ctx.oid })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  
  return {
    ok: true,
    data: attempts.map(a => ({
      _id: a._id.toString(),
      ip: a.ip || 'Unknown',
      userAgent: a.userAgent || 'Unknown',
      status: a.status,
      createdAt: a.createdAt,
    }))
  };
}
`;

if (!code.includes('getRecentLoginAttempts')) {
  fs.writeFileSync(path, code + newCode);
}
