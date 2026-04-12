import { NextResponse } from 'next/server';
import net from 'net';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Minimal WHOIS client — queries IANA, then the appropriate TLD server.
function whoisQuery(host: string, query: string, timeout = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: 43, timeout });
    const chunks: Buffer[] = [];
    socket.on('connect', () => socket.write(query + '\r\n'));
    socket.on('data', (d) => chunks.push(d));
    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('whois timeout'));
    });
    socket.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function findReferral(raw: string): string | null {
  const match = raw.match(/refer:\s*(\S+)/i) || raw.match(/Registrar WHOIS Server:\s*(\S+)/i) || raw.match(/whois:\s*(\S+)/i);
  return match ? match[1] : null;
}

export async function POST(req: Request) {
  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== 'string' || !/^[a-z0-9.-]+$/i.test(domain)) {
      return NextResponse.json({ error: 'valid domain required' }, { status: 400 });
    }

    const ianaRaw = await whoisQuery('whois.iana.org', domain);
    const refer = findReferral(ianaRaw);
    let raw = ianaRaw;
    let server = 'whois.iana.org';
    if (refer) {
      try {
        raw = await whoisQuery(refer, domain);
        server = refer;
        const second = findReferral(raw);
        if (second && second !== refer) {
          try {
            raw = await whoisQuery(second, domain);
            server = second;
          } catch {}
        }
      } catch {}
    }

    const parsed: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([\w \-]+):\s*(.+?)\s*$/);
      if (m) {
        const key = m[1].trim().toLowerCase();
        if (!parsed[key]) parsed[key] = m[2];
      }
    }
    return NextResponse.json({ domain, server, parsed, raw });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'whois failed' }, { status: 500 });
  }
}
