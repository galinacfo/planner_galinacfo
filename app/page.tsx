"use client";

import { useMemo, useState } from "react";

const DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const fullDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function rangeLabel(start: Date, end: Date) {
  if (start.getFullYear() !== end.getFullYear()) return `${shortDate.format(start)} ${start.getFullYear()} — ${shortDate.format(end)} ${end.getFullYear()}`;
  if (start.getMonth() !== end.getMonth()) return `${shortDate.format(start)} — ${shortDate.format(end)} ${end.getFullYear()}`;
  return `${start.getDate()}–${shortDate.format(end)} ${end.getFullYear()}`;
}

function getWeekNumber(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil(((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function Home() {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const weekStart = useMemo(() => addDays(startOfWeek(today), weekOffset * 7), [today, weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  return (
    <main className="planner-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">✓</div>
          <div><h1>Моя неделя</h1><p>Планируйте спокойно. Делайте важное.</p></div>
        </div>
        <nav className="week-navigation" aria-label="Навигация по неделям">
          <button className="today-button" type="button" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>Сегодня</button>
          <div className="arrow-group">
            <button type="button" aria-label="Предыдущая неделя" onClick={() => setWeekOffset((value) => value - 1)}>←</button>
            <button type="button" aria-label="Следующая неделя" onClick={() => setWeekOffset((value) => value + 1)}>→</button>
          </div>
          <p className="date-range" aria-live="polite">{rangeLabel(weekStart, days[6])}</p>
        </nav>
      </header>

      <section className="week-section" aria-label="Задачи на неделю">
        <div className="section-heading">
          <p className="eyebrow">Недельный обзор</p>
          <p className="week-number">Неделя {getWeekNumber(weekStart).toString().padStart(2, "0")}</p>
        </div>
        <div className="week-grid">
          {days.map((date, index) => {
            const isToday = weekOffset === 0 && sameDay(date, today);
            return (
              <article className={`day-column${isToday ? " is-today" : ""}`} key={date.toISOString()}>
                <header className="day-header">
                  <div><p className="day-name">{DAY_NAMES[index]}</p><p className="day-date">{fullDate.format(date)}</p></div>
                  {isToday && <span className="today-pill">Сегодня</span>}
                </header>
                <div className="empty-state"><span className="empty-icon" aria-hidden="true">✓</span><p>Нет задач</p><span>Свободный день</span></div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
