"use client";

/**
 * Drop-in "Print / PDF" trigger for the SabSheet v2 ribbon (View tab).
 *
 * Opens the dedicated, chrome-free print route in a new tab, where the browser's native print → PDF
 * pipeline takes over. Intentionally tiny and unstyled-by-default: the ribbon passes whatever
 * `className` / `children` it wants so this matches the surrounding View-tab buttons.
 */

interface PrintButtonProps {
  /** Workbook to print — used to build `/dashboard/sabsheet/v2/<workbookId>/print`. */
  workbookId: string;
  /** Optional active-sheet index to print (defaults to the first sheet, index 0). */
  sheet?: number;
  /** Ribbon button class so this inherits the View-tab look. */
  className?: string;
  /** Label / icon; defaults to "Print / PDF". */
  children?: React.ReactNode;
  /** Tooltip. */
  title?: string;
}

export function PrintButton({
  workbookId,
  sheet,
  className,
  children = "Print / PDF",
  title = "Print or save this sheet as PDF",
}: PrintButtonProps) {
  const href =
    `/dashboard/sabsheet/v2/${encodeURIComponent(workbookId)}/print` +
    (sheet != null ? `?sheet=${sheet}` : "");

  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" title={title}>
      {children}
    </a>
  );
}
