import { ErrorBoundary } from '../error-boundary';

export default function StockTransfersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
