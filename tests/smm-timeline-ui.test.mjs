import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const timelineSource = await readFile(new URL("../src/pages/SmmTimeline.jsx", import.meta.url), "utf8");
const nightStyles = await readFile(new URL("../src/pluno-night.css", import.meta.url), "utf8");
const platformSql = await readFile(new URL("../supabase/smm-timeline-other-platform.sql", import.meta.url), "utf8");
const clientDeleteSql = await readFile(new URL("../supabase/smm-timeline-client-delete.sql", import.meta.url), "utf8");

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

test("timeline uses one control system for reference, platform, format, status, and schedule", () => {
  assert.match(timelineSource, /smm-reference-control/);
  assert.match(timelineSource, /smm-multi-trigger smm-timeline-control/);
  assert.match(timelineSource, /smm-status smm-timeline-control/);
  assert.match(timelineSource, /smm-schedule-control smm-timeline-control/);
  assert.match(nightStyles, /TIMELINE V13 - UNIFIED CONTROLS AND CLIENT DIALOG/);
  assert.match(nightStyles, /#root \.smm-timeline-control,[\s\S]*?height: 40px !important/);
});

test("Add Client atomically selects active names and resets legacy inactive names", () => {
  assert.match(timelineSource, /\.rpc\("create_smm_client_timeline"/);
  assert.match(timelineSource, /already exists and has been selected/);
  assert.doesNotMatch(timelineSource, /This client already exists\. Select it from the client list instead\./);
  assert.match(clientDeleteSql, /create or replace function public\.create_smm_client_timeline/);
  assert.match(clientDeleteSql, /pg_advisory_xact_lock/);
  assert.match(clientDeleteSql, /active = false[\s\S]*?delete from public\.smm_timeline_items/);
  assert.match(clientDeleteSql, /'reset', reset_client/);
  assert.match(clientDeleteSql, /revoke all on function public\.create_smm_client_timeline\(text\) from public/);
  assert.match(clientDeleteSql, /grant execute on function public\.create_smm_client_timeline\(text\) to authenticated/);
  assert.match(timelineSource, /className="smm-modal smm-client-modal"/);
  assert.match(timelineSource, /className="smm-client-form-error" role="alert"/);
  assert.match(nightStyles, /#root \.smm-client-modal \{/);
});

test("Delete Client permanently removes timeline data through a guarded transaction", () => {
  assert.match(timelineSource, /\.rpc\("delete_smm_client"/);
  assert.doesNotMatch(timelineSource, /\.from\("smm_clients"\)\.update\(\{ active: false \}\)/);
  assert.match(clientDeleteSql, /security invoker/);
  assert.match(clientDeleteSql, /role in \('Founder', 'Administrator'\)/);
  assert.match(clientDeleteSql, /on public\.smm_clients for select to authenticated/);
  assert.match(clientDeleteSql, /delete from public\.smm_timeline_items/);
  assert.match(clientDeleteSql, /delete from public\.smm_timelines/);
  assert.match(clientDeleteSql, /delete from public\.smm_clients/);
  assert.match(clientDeleteSql, /grant execute on function public\.delete_smm_client\(uuid\) to authenticated/);
  assert.match(clientDeleteSql, /revoke all on function public\.delete_smm_client\(uuid\) from public/);
});
