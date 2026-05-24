const fs = require('fs');
const path = './src/app/api/auth/session/route.ts';
let code = fs.readFileSync(path, 'utf8');

const logCode = `
        const reqIp = request.headers.get('x-forwarded-for') || request.ip || 'Unknown';
        const reqUserAgent = request.headers.get('user-agent') || 'Unknown';
        await db.collection('login_attempts').insertOne({
            userId: user._id,
            ip: reqIp,
            userAgent: reqUserAgent,
            status: challenge.requires2fa ? 'pending_2fa' : 'success',
            createdAt: now
        });
`;

code = code.replace(
  'const challenge = await checkRequires2fa(user._id.toString());',
  'const challenge = await checkRequires2fa(user._id.toString());\n' + logCode
);

fs.writeFileSync(path, code);
