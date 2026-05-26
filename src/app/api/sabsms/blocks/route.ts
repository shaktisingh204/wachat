import { NextResponse } from 'next/server';
import { MOCK_BLOCKS } from '@/app/sabsms/sabflow-blocks/mock-data';

export async function GET() {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return NextResponse.json({ blocks: MOCK_BLOCKS });
}
