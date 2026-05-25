import { NextResponse } from 'next/server';
import { promises as dns } from 'dns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME' | 'SOA';
const SUPPORTED: RecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(req: Request) {
  try {
    const { host, type } = await req.json();
    if (!host || typeof host !== 'string') {
      return NextResponse.json(
        { error: 'host is required' },
        { status: 400, headers: corsHeaders() }
      );
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
      })
    );
    return NextResponse.json({ host, records: results }, { headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'dns lookup failed' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

