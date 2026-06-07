/**
 * /dashboard/facebook/custom-ecommerce/layout.tsx
 *
 * Ui20 scope wrap for the Custom E-commerce module. Inherits the global
 * shell from /dashboard/layout.tsx — no bespoke chrome here, only neutral
 * tokens and a max-width container.
 */
export default function CustomEcommerceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full bg-[var(--st-bg)] text-[var(--st-text)]">{children}</div>
  );
}
