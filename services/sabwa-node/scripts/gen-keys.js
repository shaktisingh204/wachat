import { randomBytes } from 'node:crypto';
console.log(`AUTH_STATE_KEY=${randomBytes(32).toString('base64')}`);
console.log(`SABWA_JWT_SECRET=${randomBytes(48).toString('base64')}`);
console.log(`SABWA_ENGINE_TOKEN=${randomBytes(32).toString('hex')}`);
