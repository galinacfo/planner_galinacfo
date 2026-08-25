import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the weekly planner", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Моя неделя/);
  assert.match(html, /Понедельник/);
  assert.match(html, /Воскресенье/);
  assert.equal((html.match(/Нет задач/g) ?? []).length, 7);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview/);
});

test("calendar logic anchors the week on Monday and scopes today's highlight", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /\(result\.getDay\(\) \+ 6\) % 7/);
  assert.match(page, /weekOffset \* 7/);
  assert.match(page, /setWeekOffset\(0\)/);
  assert.match(page, /weekOffset === 0 && sameDay\(date, today\)/);
  assert.match(page, /Array\.from\(\{ length: 7 \}/);
});
