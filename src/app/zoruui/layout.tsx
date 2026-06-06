import { ZoruProvider } from '@/components/sabcrm/20ui/compat';
import "@/styles/zoruui.css";
import { ZoruGalleryLayout } from "./ZoruGalleryLayout";

export const metadata = {
  title: "ZoruUI — SabNode",
  description: "Pure black-and-white component system.",
};

export default function ZoruuiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ZoruProvider as="main">
      <ZoruGalleryLayout>{children}</ZoruGalleryLayout>
    </ZoruProvider>
  );
}
