import 'server-only';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface AuditTrailSummary {
  envelope: {
    id: string;
    name: string;
    status: string;
    docName?: string;
    createdAt?: string;
    completedAt?: string;
  };
  signers: Array<{
    name: string;
    email: string;
    role: string;
    authMethod: string;
    status: string;
    ip?: string;
    completedAt?: string;
    declinedAt?: string;
  }>;
  events: Array<{
    eventType: string;
    ts: string;
    signerId?: string;
    ip?: string;
  }>;
  chainValid: boolean;
}

/**
 * Render a "Certificate of Completion" / audit-trail PDF: envelope metadata,
 * the signer roster (with auth method, IP, timestamps), the full event log,
 * and the tamper-evident chain verdict. Returns the PDF bytes.
 *
 * Deterministic and dependency-light (jsPDF + autotable) — no coordinate
 * mapping, so this is robust regardless of the field-builder convention.
 */
export function renderAuditTrailPdf(summary: AuditTrailSummary): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const left = 40;

  doc.setFontSize(18);
  doc.text('Certificate of Completion', left, 50);

  doc.setFontSize(10);
  doc.setTextColor(60);
  const meta: Array<[string, string]> = [
    ['Document', summary.envelope.docName || summary.envelope.name],
    ['Envelope', summary.envelope.name],
    ['Envelope ID', summary.envelope.id],
    ['Status', summary.envelope.status],
    ['Created', summary.envelope.createdAt || '—'],
    ['Completed', summary.envelope.completedAt || '—'],
    ['Audit chain', summary.chainValid ? 'VALID — not tampered' : 'INVALID — chain broken'],
  ];
  let y = 74;
  for (const [k, v] of meta) {
    doc.setTextColor(120);
    doc.text(`${k}:`, left, y);
    doc.setTextColor(30);
    doc.text(String(v), left + 90, y);
    y += 15;
  }

  autoTable(doc, {
    startY: y + 12,
    head: [['Signer', 'Email', 'Role', 'Auth', 'Status', 'IP', 'Signed / declined']],
    body: summary.signers.map((s) => [
      s.name,
      s.email,
      s.role,
      s.authMethod,
      s.status,
      s.ip || '—',
      s.completedAt || s.declinedAt || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [124, 58, 237] },
    margin: { left, right: left },
  });

  const afterSigners =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 12;

  autoTable(doc, {
    startY: afterSigners + 22,
    head: [['#', 'Event', 'Timestamp (UTC)', 'Signer', 'IP']],
    body: summary.events.map((e, i) => [
      String(i + 1),
      e.eventType,
      e.ts,
      e.signerId || '—',
      e.ip || '—',
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30] },
    margin: { left, right: left },
  });

  return new Uint8Array(doc.output('arraybuffer'));
}
