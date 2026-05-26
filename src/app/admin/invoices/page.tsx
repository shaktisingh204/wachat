import { Metadata } from "next";
import { InvoiceGenerator } from "./components/invoice-generator";

export const metadata: Metadata = {
  title: "Invoice Generator",
  description: "Create and download invoices",
};

export default function InvoicesPage() {
  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zoru-ink">Invoice Generator</h1>
          <p className="text-sm text-zoru-ink-muted mt-1">
            Create, preview, and download professional invoices as PDF.
          </p>
        </div>
      </div>
      
      <div className="mt-4">
        <InvoiceGenerator />
      </div>
    </div>
  );
}
