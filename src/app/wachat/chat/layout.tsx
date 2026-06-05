'use client';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <WachatPage variant="app">{children}</WachatPage>;
}
