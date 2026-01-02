
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { from, to, src_ip } = await req.json();

  if (!from || !to) {
    return NextResponse.json({ allow: 0 });
  }

  // TODO: Add logic here to dynamically find an available agent's SIP URI
  // For now, we'll hardcode a destination for testing purposes.
  return NextResponse.json({
    allow: 1,
    destination: "sip:agent1@sip.wapliatesting.xyz"
  });
}
