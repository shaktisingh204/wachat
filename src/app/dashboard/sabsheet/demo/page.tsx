/**
 * SabSheet v2 demo — an in-memory, non-persistent grid (no `workbookId`), seeded with a small budget
 * + a `=SUM`. Edits are not saved; this exercises the engine without touching the database. Requires
 * `npm run sabsheet:wasm` to have published the engine.
 */
import { Workbench } from "@/components/sabsheet/workbench";
import { cmd, type Command } from "@/lib/sabsheet/commands/ops";

export const dynamic = "force-dynamic";

const SEED: Command[] = [
  cmd.setCell(0, 1, 1, "Item"),
  cmd.setCell(0, 1, 2, "Qty"),
  cmd.setCell(0, 1, 3, "Price"),
  cmd.setCell(0, 1, 4, "Total"),
  cmd.setCell(0, 2, 1, "Widgets"),
  cmd.setCell(0, 2, 2, "10"),
  cmd.setCell(0, 2, 3, "2.50"),
  cmd.setCell(0, 2, 4, "=B2*C2"),
  cmd.setCell(0, 3, 1, "Gadgets"),
  cmd.setCell(0, 3, 2, "4"),
  cmd.setCell(0, 3, 3, "9.99"),
  cmd.setCell(0, 3, 4, "=B3*C3"),
  cmd.setCell(0, 4, 1, "Total"),
  cmd.setCell(0, 4, 4, "=SUM(D2:D3)"),
];

export default function SabSheetV2DemoPage() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Workbench name="Demo spreadsheet" seed={SEED} />
    </div>
  );
}
