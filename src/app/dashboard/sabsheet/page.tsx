/**
 * SabSheet home — Google-Sheets-style launcher: a "Start a new spreadsheet" template strip on a
 * light band, then the recents grid (grid-pattern thumbnails). Opens workbooks in the
 * IronCalc-backed editor (persistent + offline-capable).
 */
import Link from "next/link";
import { listSabsheetWorkbooks } from "@/app/actions/sabsheet.actions";
import { SheetIcon } from "@/components/sabsheet/chrome/sheet-icon";
import { NewWorkbookButton } from "./_new-workbook-button.tsx";

export const dynamic = "force-dynamic";

const CSS = `
.sbsl { min-height: 100%; background: #fff; font: 14px -apple-system, system-ui, sans-serif; color: #1f1f1f; }
.sbsl-top { display: flex; align-items: center; gap: 10px; padding: 14px 28px 10px; }
.sbsl-top h1 { margin: 0; font: 400 20px -apple-system, system-ui, sans-serif; color: #5f6368; }
.sbsl-hero { background: #f1f3f4; padding: 16px 0 26px; }
.sbsl-wrap { max-width: 1024px; margin: 0 auto; padding: 0 28px; }
.sbsl-secthead { display: flex; align-items: center; justify-content: space-between; font: 500 14px -apple-system, system-ui, sans-serif; color: #202124; margin: 10px 0 14px; }
.sbsl-row { display: flex; gap: 20px; flex-wrap: wrap; }
.sbsl-tpl { display: flex; flex-direction: column; }
.sbsl-card {
  width: 164px; height: 124px; background: #fff; border: 1px solid #dadce0; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;
  transition: border-color 120ms ease;
}
@media (hover: hover) and (pointer: fine) { .sbsl-card:hover { border-color: #1a73e8; } }
.sbsl-card:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
.sbsl-tlabel { font: 500 13px -apple-system, system-ui, sans-serif; color: #202124; margin-top: 10px; }
.sbsl-tsub { font-size: 12px; color: #5f6368; margin-top: 2px; }
.sbsl-files { display: grid; grid-template-columns: repeat(auto-fill, minmax(212px, 1fr)); gap: 18px; margin-top: 6px; padding-bottom: 48px; }
.sbsl-file {
  display: block; border: 1px solid #dadce0; border-radius: 10px; overflow: hidden;
  text-decoration: none; color: inherit; background: #fff;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .sbsl-file:hover { border-color: #1a73e8; box-shadow: 0 1px 3px rgba(60,64,67,.18); }
}
.sbsl-file:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
.sbsl-thumb {
  height: 126px; border-bottom: 1px solid #eef1f4; background-color: #fff;
  background-image: linear-gradient(#eef1f4 1px, transparent 1px), linear-gradient(90deg, #eef1f4 1px, transparent 1px);
  background-size: 26px 19px;
}
.sbsl-meta { display: flex; align-items: center; gap: 9px; padding: 11px 13px; }
.sbsl-fname { font: 500 13px -apple-system, system-ui, sans-serif; color: #1f1f1f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbsl-fsub { font-size: 11.5px; color: #5f6368; margin-top: 1px; }
.sbsl-empty {
  margin-top: 10px; padding: 64px 24px; text-align: center; color: #5f6368;
  border: 1px dashed #dadce0; border-radius: 12px;
}
`;

export default async function SabSheetLauncherPage() {
  let workbooks: { _id: string; title: string }[] = [];
  try {
    workbooks = await listSabsheetWorkbooks();
  } catch {
    workbooks = [];
  }

  return (
    <div className="sbsl">
      <style>{CSS}</style>

      <div className="sbsl-top">
        <SheetIcon size={30} />
        <h1>SabSheet</h1>
      </div>

      <div className="sbsl-hero">
        <div className="sbsl-wrap">
          <div className="sbsl-secthead">Start a new spreadsheet</div>
          <div className="sbsl-row">
            <NewWorkbookButton />
            <Link href="/dashboard/sabsheet/demo" className="sbsl-tpl" style={{ textDecoration: "none" }}>
              <span className="sbsl-card" role="presentation">
                <SheetIcon size={44} />
              </span>
              <span className="sbsl-tlabel">Demo sheet</span>
              <span className="sbsl-tsub">Formulas, no sign-up data</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="sbsl-wrap">
        <div className="sbsl-secthead">
          <span>Recent spreadsheets</span>
          <span style={{ color: "#5f6368", fontWeight: 400 }}>{workbooks.length || ""}</span>
        </div>

        {workbooks.length === 0 ? (
          <div className="sbsl-empty">No spreadsheets yet — create one above to get started.</div>
        ) : (
          <div className="sbsl-files">
            {workbooks.map((wb) => (
              <Link key={wb._id} href={`/dashboard/sabsheet/${wb._id}`} className="sbsl-file">
                <div className="sbsl-thumb" aria-hidden />
                <div className="sbsl-meta">
                  <SheetIcon size={20} />
                  <div style={{ minWidth: 0 }}>
                    <div className="sbsl-fname">{wb.title || "Untitled spreadsheet"}</div>
                    <div className="sbsl-fsub">Spreadsheet</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
