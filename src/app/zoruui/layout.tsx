import { ZoruProvider } from '@/components/zoruui';
import "@/styles/zoruui.css";

export const metadata = {
  title: "ZoruUI — SabNode",
  description: "Pure black-and-white component system.",
};

export default function ZoruuiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ZoruProvider as="main">{children}</ZoruProvider>;
}
