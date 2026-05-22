/**
 * parseRecipientList — unit tests.
 *
 * Run with the project's standard runner:
 *   npx tsx --test src/app/sabsms/quick-send/__tests__/parse.test.ts
 *
 * Uses `node:test` describe/it (also Vitest-shape compatible) — the
 * project standardised on `tsx --test` and does not have vitest
 * installed. See `src/app/sabsms/campaigns/new/__tests__/draft.test.ts`
 * for the canonical example.
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  interpolateBody,
  normalisePhone,
  parseRecipientList,
  segmentCount,
} from "../parse";

describe("normalisePhone", () => {
  it("accepts a clean E.164", () => {
    assert.equal(normalisePhone("+15551234567"), "+15551234567");
  });

  it("strips spaces, dashes, parens, dots", () => {
    assert.equal(normalisePhone(" +1 (555) 123-4567 "), "+15551234567");
    assert.equal(normalisePhone("+1.555.123.4567"), "+15551234567");
  });

  it("prepends + when missing and digits look international", () => {
    assert.equal(normalisePhone("15551234567"), "+15551234567");
  });

  it("rejects letters and clearly-short input", () => {
    assert.equal(normalisePhone("not-a-phone"), null);
    assert.equal(normalisePhone("123"), null);
    assert.equal(normalisePhone(""), null);
  });
});

describe("parseRecipientList — newline format", () => {
  it("parses one phone per line", () => {
    const r = parseRecipientList("+15551234567\n+447911123456\n+919876543210");
    assert.equal(r.rows.length, 3);
    assert.equal(r.errors.length, 0);
    assert.equal(r.variableColumns, null);
    assert.deepEqual(
      r.rows.map((row) => row.phone),
      ["+15551234567", "+447911123456", "+919876543210"],
    );
  });

  it("preserves source line numbers across blank lines", () => {
    const r = parseRecipientList("\n\n+15551234567\n\n+447911123456\n");
    assert.equal(r.rows.length, 2);
    assert.equal(r.rows[0].sourceLine, 3);
    assert.equal(r.rows[1].sourceLine, 5);
  });
});

describe("parseRecipientList — comma format", () => {
  it("parses comma-separated phones on one line", () => {
    const r = parseRecipientList("+15551234567, +447911123456,+919876543210");
    assert.equal(r.rows.length, 3);
    assert.equal(r.errors.length, 0);
  });

  it("handles mixed comma and newline", () => {
    const r = parseRecipientList(
      "+15551234567,+15551234568\n+447911123456",
    );
    assert.equal(r.rows.length, 3);
  });
});

describe("parseRecipientList — TSV/CSV with header", () => {
  it("parses TSV with phone + variable columns", () => {
    const input =
      "phone\tfirst_name\torder_id\n" +
      "+15551234567\tAlice\tORD-1\n" +
      "+447911123456\tBob\tORD-2";
    const r = parseRecipientList(input);
    assert.equal(r.errors.length, 0);
    assert.equal(r.rows.length, 2);
    assert.deepEqual(r.variableColumns, ["first_name", "order_id"]);
    assert.deepEqual(r.rows[0].vars, {
      first_name: "Alice",
      order_id: "ORD-1",
    });
    assert.deepEqual(r.rows[1].vars, {
      first_name: "Bob",
      order_id: "ORD-2",
    });
  });

  it("parses CSV with phone + variable columns", () => {
    const input =
      "phone,first_name,city\n" +
      "+15551234567,Alice,NYC\n" +
      "+447911123456,Bob,London";
    const r = parseRecipientList(input);
    assert.equal(r.errors.length, 0);
    assert.equal(r.rows.length, 2);
    assert.deepEqual(r.variableColumns, ["first_name", "city"]);
    assert.equal(r.rows[1].vars.city, "London");
  });

  it("flags rows with the wrong column count", () => {
    const input =
      "phone,first_name,city\n" +
      "+15551234567,Alice\n" +
      "+447911123456,Bob,London";
    const r = parseRecipientList(input);
    assert.equal(r.rows.length, 1);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].kind, "column_mismatch");
  });
});

describe("parseRecipientList — dedup", () => {
  it("dedupes preserving the first occurrence and reports later ones", () => {
    const input = "+15551234567\n+15551234567\n+447911123456";
    const r = parseRecipientList(input);
    assert.equal(r.rows.length, 2);
    assert.equal(r.rows[0].sourceLine, 1);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].kind, "duplicate");
    assert.equal(r.errors[0].line, 2);
  });

  it("dedupes after normalisation", () => {
    // "+1 (555) 123-4567" normalises to the same E.164 as "+15551234567".
    const input = "+15551234567\n+1 (555) 123-4567";
    const r = parseRecipientList(input);
    assert.equal(r.rows.length, 1);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].kind, "duplicate");
  });
});

describe("parseRecipientList — invalid phones", () => {
  it("collects invalid phones as errors with line numbers", () => {
    const input = "+15551234567\nnot-a-phone\n+447911123456\n";
    const r = parseRecipientList(input);
    assert.equal(r.rows.length, 2);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].kind, "invalid_phone");
    assert.equal(r.errors[0].line, 2);
  });

  it("flags empty input", () => {
    const r = parseRecipientList("   \n\n   ");
    assert.equal(r.rows.length, 0);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].kind, "empty");
  });
});

describe("interpolateBody", () => {
  it("substitutes variables", () => {
    assert.equal(
      interpolateBody("Hi {{first_name}}!", { first_name: "Alice" }),
      "Hi Alice!",
    );
  });

  it("leaves unknown keys intact", () => {
    assert.equal(
      interpolateBody("Hi {{first_name}} order {{order_id}}", {
        first_name: "Alice",
      }),
      "Hi Alice order {{order_id}}",
    );
  });
});

describe("segmentCount", () => {
  it("counts a short GSM-7 message as 1 segment", () => {
    const r = segmentCount("Hello world");
    assert.equal(r.segments, 1);
    assert.equal(r.encoding, "GSM-7");
  });

  it("switches to UCS-2 for emoji", () => {
    const r = segmentCount("Hello \u{1F600}");
    assert.equal(r.encoding, "UCS-2");
  });

  it("returns 0 segments for empty body", () => {
    assert.equal(segmentCount("").segments, 0);
  });
});
