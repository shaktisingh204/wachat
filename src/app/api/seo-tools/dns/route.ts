import { NextResponse } from 'next/server';
import { promises as dns } from 'dns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME' | 'SOA';
const SUPPORTED: RecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'];

export async function POST(req: Request) {
  try {
    const { host, type } = await req.json();
    if (!host || typeof host !== 'string') {
      return NextResponse.json({ error: 'host is required' }, { status: 400 });
    }
    const types: RecordType[] = type && SUPPORTED.includes(type) ? [type] : SUPPORTED;
    const results: Record<string, any> = {};
    await Promise.all(
      types.map(async (t) => {
        try {
          results[t] = await (dns.resolve as any)(host, t);
        } catch (e: any) {
          results[t] = { error: e?.code || 'lookup failed' };
        }
      }),
    );
    return NextResponse.json({ host, records: results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'dns lookup failed' }, { status: 500 });
  }
}
