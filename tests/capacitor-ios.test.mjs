import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Capacitor points to the Vite production bundle", async () => {
  const config = JSON.parse(await read("../capacitor.config.json"));

  assert.equal(config.appId, "com.plunostudio.portalinternal");
  assert.equal(config.webDir, "dist");
});

test("password recovery keeps web redirect and adds the native app link", async () => {
  const nativeAuth = await read("../src/lib/nativeAuth.js");

  assert.match(nativeAuth, /com\.plunostudio\.portalinternal/);
  assert.match(nativeAuth, /RESET_PASSWORD_ROUTE = "\/reset-password"/);
  assert.match(nativeAuth, /window\.location\.origin/);
  assert.match(nativeAuth, /supabase\.auth\.setSession/);
});

test("Social Media Worker accepts the iOS WebView origin", async () => {
  const workerConfig = await read("../worker/wrangler.jsonc");

  assert.match(workerConfig, /capacitor:\/\/localhost/);
});

test("shared links use the public HTTPS portal outside the native WebView", async () => {
  const publicUrl = await read("../src/lib/publicAppUrl.js");
  const gallery = await read("../src/pages/GalleryManager.jsx");
  const timeline = await read("../src/pages/SmmTimeline.jsx");

  assert.match(publicUrl, /https:\/\/internal\.plunostudio\.com/);
  assert.match(gallery, /getPublicAppUrl\(`\/gallery\//);
  assert.match(timeline, /getPublicAppUrl\(`\/timeline\/share\//);
});
