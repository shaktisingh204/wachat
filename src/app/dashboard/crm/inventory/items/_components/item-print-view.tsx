import { Card } from '@/components/sabcrm/20ui/compat';
import { fmtINR } from '@/lib/utils';
/**
 * <ItemPrintView> — A4 label sheet for an item barcode or QR.
 *
 * Activated via `?print=1` (barcode) or `?qr=1` (QR) on the item detail
 * page. The component renders a printable grid of identical labels —
 * users can `cmd+P` from the popup the detail-page actions open.
 *
 * Codes are server-rendered as SVGs via inline path templates so we
 * don't pull a barcode library client-side. For QR, we use the public
 * Google Chart API stub so it works without extra deps; swap to a
 * locally-bundled QR generator when one ships.
 */

interface ItemPrintViewProps {
  variant: 'barcode' | 'qr';
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  sellingPrice: number;
  currency: string;
}

// 3-column × 8-row standard label sheet (24 labels per A4).
const LABELS_PER_SHEET = 24;

export function ItemPrintView({
  variant,
  productId,
  productName,
  sku,
  barcode,
  sellingPrice,
  currency,
}: ItemPrintViewProps) {
  const code = barcode || sku || productId;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
    code,
  )}`;

  return (
    <div className="space-y-4 print:space-y-0">
      <Card className="p-4 print:hidden">
        <p className="text-[12.5px] text-zoru-ink-muted">
          Press <kbd>Ctrl/Cmd + P</kbd> to print. Use a 3×8 label sheet (24
          labels per page).
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: LABELS_PER_SHEET }).map((_, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center rounded border border-zoru-line bg-white p-2 text-center text-zoru-ink print:break-inside-avoid"
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink">
              {productName}
            </div>
            {variant === 'qr' ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrSrc}
                alt={`QR for ${sku}`}
                className="my-2 h-24 w-24"
              />
            ) : (
              <BarcodeSvg code={code} />
            )}
            <div className="text-[11px] font-mono">{code}</div>
            <div className="text-[10.5px] text-zoru-ink">
              {fmtINR(sellingPrice, currency)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── BarcodeSvg — minimal Code128-ish visual ────────────────────────── */

function BarcodeSvg({ code }: { code: string }) {
  // We don't ship a real Code128 encoder; this renders a deterministic
  // stripe pattern derived from char codes. Scanners won't read it, but
  // it gives users a printable visual marker until a real encoder lands.
  const bars: number[] = [];
  for (let i = 0; i < code.length; i++) {
    bars.push((code.charCodeAt(i) % 7) + 1);
  }
  const barWidth = 2;
  const height = 36;
  let x = 0;
  return (
    <svg
      viewBox={`0 0 ${bars.length * barWidth * 2} ${height}`}
      className="my-2 h-9 w-full"
      aria-label={`Barcode ${code}`}
    >
      {bars.map((b, idx) => {
        const w = b * barWidth;
        const rect = (
          <rect key={idx} x={x} y={0} width={w} height={height} fill="black" />
        );
        x += w + barWidth;
        return rect;
      })}
    </svg>
  );
}
