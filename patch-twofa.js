const fs = require('fs');
const path = './src/app/api/auth/two-fa/route.ts';
let code = fs.readFileSync(path, 'utf8');

const logCode = `
    const reqIp = request.headers.get('x-forwarded-for') || request.ip || 'Unknown';
    const reqUserAgent = request.headers.get('user-agent') || 'Unknown';
    const now = new Date();
    const { db } = await connectToDatabase();
    await db.collection('login_attempts').insertOne({
        userId: new ObjectId(userId),
        ip: reqIp,
        userAgent: reqUserAgent,
        status: result.ok ? 'success' : 'failed',
        createdAt: now
    });
`;

code = code.replace(
  'const result = await verifyTwoFactorChallenge(userId, code);',
  'const result = await verifyTwoFactorChallenge(userId, code);\n' + logCode
);
// Also need to remove the duplicate connectToDatabase if it exists below.
code = code.replace(
  'const { db } = await connectToDatabase();\n    const user = ',
  'const user = '
);

fs.writeFileSync(path, code);
