"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Priority = "high" | "medium" | "low";
type Task = { id: string; title: string; date: string; priority: Priority; isCompleted: boolean };
const STORAGE_KEY = "weeklyPlannerTasks";

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

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<Task>;
  return typeof task.id === "string" && typeof task.title === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(task.date ?? "") &&
    ["high", "medium", "low"].includes(task.priority ?? "") &&
    typeof task.isCompleted === "boolean";
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [titleError, setTitleError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const weekStart = useMemo(() => addDays(startOfWeek(today), weekOffset * 7), [today, weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) setTasks(parsed.filter(isTask));
    } catch {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isModalOpen]);

  function openModal() {
    setEditingTaskId(null);
    setTitle("");
    setTaskDate(toDateKey(today));
    setPriority("medium");
    setTitleError("");
    setIsModalOpen(true);
  }

  function openEditModal(task: Task) {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setTaskDate(task.date);
    setPriority(task.priority);
    setTitleError("");
    setIsModalOpen(true);
  }

  function persistTasks(updatedTasks: Task[]) {
    setTasks(updatedTasks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
  }

  function toggleTask(taskId: string) {
    persistTasks(tasks.map((task) => task.id === taskId ? { ...task, isCompleted: !task.isCompleted } : task));
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setTitleError("Введите название задачи");
      return;
    }
    if (editingTaskId) {
      persistTasks(tasks.map((task) => task.id === editingTaskId ? { ...task, title: cleanTitle, date: taskDate, priority } : task));
    } else {
      const newTask: Task = { id: crypto.randomUUID(), title: cleanTitle, date: taskDate, priority, isCompleted: false };
      persistTasks([...tasks, newTask]);
      const selectedWeek = startOfWeek(dateFromKey(taskDate));
      const currentWeek = startOfWeek(today);
      setWeekOffset(Math.round((selectedWeek.getTime() - currentWeek.getTime()) / 604800000));
    }
    setIsModalOpen(false);
  }

  return (
    <main className="planner-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">✓</div>
          <div><h1>Моя неделя</h1><p>Планируйте спокойно. Делайте важное.</p></div>
        </div>
        <nav className="week-navigation" aria-label="Навигация по неделям">
          <button className="add-button" type="button" onClick={openModal}><span aria-hidden="true">＋</span> Добавить задачу</button>
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
            const dayTasks = tasks.filter((task) => task.date === toDateKey(date));
            return (
              <article className={`day-column${isToday ? " is-today" : ""}`} key={date.toISOString()}>
                <header className="day-header">
                  <div><p className="day-name">{DAY_NAMES[index]}</p><p className="day-date">{fullDate.format(date)}</p></div>
                  {isToday && <span className="today-pill">Сегодня</span>}
                </header>
                {dayTasks.length === 0 ? (
                  <div className="empty-state"><span className="empty-icon" aria-hidden="true">✓</span><p>Нет задач</p><span>Свободный день</span></div>
                ) : (
                  <div className="task-list">
                    {dayTasks.map((task) => (
                      <div className={`task-card priority-${task.priority}${task.isCompleted ? " is-completed" : ""}`} key={task.id}>
                        <label className="complete-control" title={task.isCompleted ? "Вернуть в работу" : "Отметить выполненной"}>
                          <input type="checkbox" checked={task.isCompleted} onChange={() => toggleTask(task.id)} />
                          <span aria-hidden="true">✓</span>
                          <span className="sr-only">{task.isCompleted ? "Вернуть задачу в работу" : "Отметить задачу выполненной"}</span>
                        </label>
                        <button className="task-content" type="button" onClick={() => openEditModal(task)} aria-label={`Редактировать задачу: ${task.title}`}>
                          <span className="priority-dot" aria-hidden="true" />
                          <span className="task-title">{task.title}</span>
                          <span className="priority-label">{task.priority === "high" ? "Высокий" : task.priority === "medium" ? "Средний" : "Низкий"}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {isModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }}>
          <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading">
              <div><p className="eyebrow">{editingTaskId ? "Редактирование" : "Новая задача"}</p><h2 id="modal-title">{editingTaskId ? "Изменить задачу" : "Что нужно сделать?"}</h2></div>
              <button className="close-button" type="button" aria-label="Закрыть" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={saveTask} noValidate>
              <label className="field-label" htmlFor="task-title">Название</label>
              <input id="task-title" autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setTitleError(""); }} aria-invalid={Boolean(titleError)} aria-describedby={titleError ? "title-error" : undefined} placeholder="Например, подготовить отчёт" />
              {titleError && <p className="field-error" id="title-error">{titleError}</p>}
              <div className="form-row">
                <div><label className="field-label" htmlFor="task-date">Дата</label><input id="task-date" type="date" required value={taskDate} onChange={(event) => setTaskDate(event.target.value)} /></div>
                <div><label className="field-label" htmlFor="task-priority">Приоритет</label><select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="high">Высокий</option><option value="medium">Средний</option><option value="low">Низкий</option></select></div>
              </div>
              <div className="modal-actions"><button className="cancel-button" type="button" onClick={() => setIsModalOpen(false)}>Отмена</button><button className="save-button" type="submit">Сохранить</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
