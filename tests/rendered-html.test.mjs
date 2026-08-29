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

test("stores valid tasks locally and renders titles as React text", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /weeklyPlannerTasks/);
  assert.match(page, /JSON\.parse\(stored\)/);
  assert.match(page, /JSON\.stringify\(storageTasks\)/);
  assert.match(page, /isCompleted: false/);
  assert.match(page, /if \(!cleanTitle\)/);
  assert.match(page, /className="task-title">\{task\.title\}<\/span>/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|innerHTML/);
  assert.match(page, /catch \{\s*setTasks\(\[\]\)/);
});

test("edits, moves and toggles task completion without losing fields", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /setEditingTaskId\(task\.id\)/);
  assert.match(page, /task\.id === editingTaskId \? \{ \.\.\.task, title: cleanTitle, date: taskDate, priority \}/);
  assert.match(page, /isCompleted: !task\.isCompleted/);
  assert.match(page, /checked=\{task\.isCompleted\}/);
  assert.match(page, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(storageTasks\)\)/);
  assert.match(page, /task\.date === dateKey/);
});

test("shows unfinished overdue tasks only in today's column without changing their date", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /task\.date < todayKey && !task\.isCompleted/);
  assert.match(page, /return isToday \? \[\.\.\.overdueTasks, \.\.\.regularTasks\] : regularTasks/);
  assert.match(page, /task\.date === dateKey && !\(task\.date < todayKey && !task\.isCompleted\)/);
  assert.match(page, /Просрочено с \{overdueDate\.format\(dateFromKey\(task\.date\)\)\}/);
  assert.match(page, /if \(taskDate < todayKey\) \{\s*setWeekOffset\(0\)/);
  assert.doesNotMatch(page, /date:\s*todayKey/);
});

test("deletes with a five-second undo window and restores the original task", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /setTimeout\(\(\) => \{/);
  assert.match(page, /\}, 5000\)/);
  assert.match(page, /clearTimeout\(deleteTimerRef\.current\)/);
  assert.match(page, /snapshot = \{ task: tasksRef\.current\[index\], index \}/);
  assert.match(page, /restoredTasks\.splice\(Math\.min\(pending\.index, restoredTasks\.length\), 0, pending\.task\)/);
  assert.match(page, /filter\(\(task\) => task\.id !== editingTaskId\)/);
  assert.match(page, /Задача удалена/);
  assert.match(page, />Отменить<\/button>/);
});

test("builds a stable sticky mobile header with a floating add button", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /className="week-controls"[\s\S]*changeWeek\(-1\)[\s\S]*className="today-button"[\s\S]*changeWeek\(1\)/);
  assert.match(page, /className="mobile-add-button"[\s\S]*onClick=\{openModal\}/);
  assert.match(css, /\.topbar\{position:sticky;z-index:10;top:8px/);
  assert.match(css, /\.mobile-add-button \{ display:none; \}/);
  assert.match(css, /\.mobile-add-button\{position:fixed;z-index:18;right:18px;bottom:18px/);
  assert.match(css, /\.week-controls\{grid-row:2;display:grid;grid-template-columns:44px minmax\(0,1fr\) 44px/);
});
