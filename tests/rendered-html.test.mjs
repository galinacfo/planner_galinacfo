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
  assert.match(css, /\.mobile-add-button\{position:fixed;z-index:18;right:18px;bottom:calc\(18px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.week-controls\{grid-row:2;display:grid;grid-template-columns:44px minmax\(0,1fr\) 44px/);
});

test("provides mobile-friendly touch targets and readable task text", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.complete-control\{width:44px;height:44px;flex-basis:44px/);
  assert.match(css, /\.complete-control > span\[aria-hidden\]\{width:22px;height:22px\}/);
  assert.match(css, /\.task-content\{width:100%;min-height:44px/);
  assert.match(css, /\.task-title\{margin:0;overflow-wrap:anywhere;white-space:pre-wrap;font-size:15px;line-height:1\.45\}/);
  assert.match(css, /\.overdue-label\{margin:6px 0 0;font-size:12px\}/);
  assert.match(css, /\.close-button\{width:44px;height:44px\}/);
  assert.match(css, /\.task-modal button\{min-height:44px\}/);
});

test("renders the mobile modal as a keyboard-safe bottom sheet", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /document\.body\.style\.overflow = "hidden"/);
  assert.match(page, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(css, /\.modal-backdrop\{padding:0;place-items:end center\}/);
  assert.match(css, /\.task-modal\{position:relative;width:100%;max-height:90dvh/);
  assert.match(css, /overflow-y:auto;overscroll-behavior:contain;border-radius:22px 22px 0 0/);
  assert.match(css, /\.modal-actions\{position:sticky;z-index:2;bottom:0/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@keyframes sheet-in/);
});

test("makes mobile task cards touch-friendly and preserves their states", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.task-card\{width:100%;padding:15px;gap:8px;align-items:center\}/);
  assert.match(css, /\.task-content\{width:100%;min-height:44px;align-self:stretch/);
  assert.match(css, /overflow-wrap:anywhere;white-space:pre-wrap;font-size:15px/);
  assert.match(css, /\.task-card\.is-completed\{opacity:\.82;background:var\(--priority-background\)/);
  assert.match(css, /\.task-card\.is-overdue\{background:#fff0ef;border-color:#efcfcc\}/);
});

test("supports swipe day navigation across week boundaries", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /selectedDayIndex === 6[\s\S]*setWeekOffset\(\(value\) => value \+ 1\)[\s\S]*setSelectedDayIndex\(0\)/);
  assert.match(page, /selectedDayIndex === 0[\s\S]*setWeekOffset\(\(value\) => value - 1\)[\s\S]*setSelectedDayIndex\(6\)/);
  assert.match(page, /Math\.abs\(deltaX\) < 50/);
  assert.match(page, /onTouchStart=\{handleDayTouchStart\} onTouchEnd=\{handleDayTouchEnd\}/);
  assert.match(css, /touch-action:pan-y/);
  assert.match(css, /@keyframes day-in/);
});

test("adds a safe-area-aware undo countdown without covering tasks", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /planner-shell\$\{pendingDelete \? " has-toast" : ""\}/);
  assert.match(page, /key=\{pendingDelete\.task\.id\}/);
  assert.match(css, /\.undo-toast::after[\s\S]*animation:toast-timer 5s linear forwards/);
  assert.match(css, /\.undo-toast button \{ min-height:44px/);
  assert.match(css, /bottom:calc\(84px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.planner-shell\.has-toast\{padding-bottom:calc\(180px \+ env\(safe-area-inset-bottom\)\)\}/);
});

test("uses dynamic viewport sizing and four responsive layout ranges", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /min-height:100dvh/);
  assert.match(css, /@media \(max-width:480px\)/);
  assert.match(css, /@media \(min-width:481px\) and \(max-width:800px\)/);
  assert.match(css, /grid-auto-columns:calc\(\(100% - 12px\)\/2\)/);
  assert.match(css, /@media \(min-width:801px\) and \(max-width:1100px\)/);
  assert.match(css, /grid-auto-columns:calc\(\(100% - 24px\)\/3\)/);
  assert.match(css, /@media \(min-width:1101px\)/);
  assert.match(css, /scroll-snap-type:x mandatory/);
  assert.match(page, /selectedColumn\?\.scrollIntoView/);
});
