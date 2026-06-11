/**
 * SabSheet v2 launcher — lists the user's workbooks and opens them in the new IronCalc-backed editor
 * (persistent + offline-capable). Creating one lands in `/dashboard/sabsheet/v2/[workbookId]`.
 */
import Link from "next/link";
import { listSabsheetWorkbooks } from "@/app/actions/sabsheet.actions";
import { NewWorkbookButton } from "./_new-workbook-button.tsx";

export const dynamic = "force-dynamic";

export default async function SabSheetV2LauncherPage() {
  let workbooks: { _id: string; title: string }[] = [];
  try {
    workbooks = await listSabsheetWorkbooks();
  } catch {
    workbooks = [];
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px", font: "14px -apple-system, system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: "#202124" }}>SabSheet</h1>
          <p style={{ margin: "4px 0 0", color: "#5f6368" }}>
            Excel-grade spreadsheets that keep working offline.{" "}
            <Link href="/dashboard/sabsheet/v2/demo" style={{ color: "#1a73e8" }}>
              Try the demo →
            </Link>
          </p>
        </div>
        <NewWorkbookButton />
      </div>

      {workbooks.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "#5f6368", border: "1px dashed #dadce0", borderRadius: 12 }}>
          No spreadsheets yet. Create one to get started.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {workbooks.map((wb) => (
            <li key={wb._id}>
              <Link
                href={`/dashboard/sabsheet/v2/${wb._id}`}
                style={{
                  display: "block",
                  height: 140,
                  padding: 16,
                  border: "1px solid #dadce0",
                  borderRadius: 12,
                  textDecoration: "none",
                  color: "#202124",
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: 28 }}>📊</div>
                <div style={{ marginTop: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {wb.title || "Untitled spreadsheet"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
