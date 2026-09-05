import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const timelineSource = await readFile(new URL("../src/pages/SmmTimeline.jsx", import.meta.url), "utf8");
const nightStyles = await readFile(new URL("../src/pluno-night.css", import.meta.url), "utf8");
const platformSql = await readFile(new URL("../supabase/smm-timeline-other-platform.sql", import.meta.url), "utf8");

test("timeline exposes Other and ships the matching database constraint update", () => {
  assert.match(timelineSource, /\["Instagram", "TikTok", "Other"\]/);
  assert.match(platformSql, /smm_timeline_items_platforms_check/);
  assert.match(platformSql, /'Instagram', 'TikTok', 'Other'/);
});

test("timeline progress uses an accessible progress bar", () => {
  assert.match(timelineSource, /role="progressbar"/);
  assert.match(timelineSource, /aria-valuenow=\{progressPercent\}/);
  assert.match(nightStyles, /\.smm-progress-track/);
});

test("timeline rows carry mobile labels and switch to card layout", () => {
  for (const label of ["Content", "Materials", "Reference", "Platform", "Format", "Status", "Schedule", "Actions"]) {
    assert.match(timelineSource, new RegExp(`data-label="${label}"`));
  }
  assert.match(nightStyles, /content: attr\(data-label\)/);
  assert.match(nightStyles, /#root \.smm-table-wrap tbody tr/);
});
