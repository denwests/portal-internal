import test from "node:test";
import assert from "node:assert/strict";
import { formatNumericDate, parseMonthValue, tryOpenPicker } from "../src/lib/uiFormatting.js";

test("numeric dates preserve calendar date without timezone shifts", () => {
  assert.equal(formatNumericDate("2026-09-04"), "04/09/2026");
  assert.equal(formatNumericDate("2026-09-04T23:00:00Z"), "04/09/2026");
  assert.equal(formatNumericDate("2024-02-29"), "29/02/2024");
});
test("invalid and missing dates are safe placeholders", () => {
  for (const value of [null, "", "garbage", "2026-02-30", "2026-13-01"]) {
    assert.equal(formatNumericDate(value), "-");
  }
});
test("month picker accepts only valid complete periods", () => {
  assert.deepEqual(parseMonthValue("2026-09"), { year: 2026, month: 9 });
  for (const value of ["", "2026-00", "2026-13", "0000-01", "2026-9"]) {
    assert.equal(parseMonthValue(value), null);
  }
});
test("picker fallback does not crash unsupported or embedded browsers", () => {
  let opened = false;
  tryOpenPicker({ showPicker: () => { opened = true; } });
  assert.equal(opened, true);
  assert.doesNotThrow(() => tryOpenPicker({}));
  assert.doesNotThrow(() => tryOpenPicker({ showPicker: () => { throw new Error("SecurityError"); } }));
});
