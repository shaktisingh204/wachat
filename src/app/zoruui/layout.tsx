import "@/styles/zoruui.css";

import { ZoruProvider } from "@/components/zoruui";

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
