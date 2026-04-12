import { NextResponse } from 'next/server';
import tls from 'tls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getCert(host: string, port = 443, timeout = 8000) {
  return new Promise<any>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout }, () => {
      const cert = socket.getPeerCertificate(true);
      const protocol = socket.getProtocol();
      const authorized = socket.authorized;
      socket.end();
      resolve({ cert, protocol, authorized });
    });
    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('ssl timeout'));
    });
  });
}

export async function POST(req: Request) {
  try {
    const { host } = await req.json();
    if (!host || typeof host !== 'string' || !/^[a-z0-9.-]+$/i.test(host)) {
      return NextResponse.json({ error: 'valid host required' }, { status: 400 });
    }
    const { cert, protocol, authorized } = await getCert(host);
    const now = Date.now();
    const validFrom = cert?.valid_from ? new Date(cert.valid_from).toISOString() : null;
    const validTo = cert?.valid_to ? new Date(cert.valid_to).toISOString() : null;
    const daysRemaining = validTo ? Math.round((new Date(validTo).getTime() - now) / 86400000) : null;
    return NextResponse.json({
      host,
      authorized,
      protocol,
      subject: cert?.subject || null,
      issuer: cert?.issuer || null,
      validFrom,
      validTo,
      daysRemaining,
      fingerprint: cert?.fingerprint || null,
      fingerprint256: cert?.fingerprint256 || null,
      serialNumber: cert?.serialNumber || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'ssl check failed' }, { status: 500 });
  }
}
