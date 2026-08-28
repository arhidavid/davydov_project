import { useEffect, useMemo, useState } from "react";
import { api, type Task } from "./api.js";

type Filter = "all" | "active" | "completed";

export function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .list()
      .then(setTasks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const remaining = tasks.filter((t) => !t.completed).length;

  const visible = useMemo(() => {
    switch (filter) {
      case "active":
        return tasks.filter((t) => !t.completed);
      case "completed":
        return tasks.filter((t) => t.completed);
      default:
        return tasks;
    }
  }, [tasks, filter]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const task = await api.create(trimmed);
      setTasks((prev) => [task, ...prev]);
      setTitle("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(task: Task) {
    try {
      const updated = await api.update(task.id, { completed: !task.completed });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(task: Task) {
    try {
      await api.remove(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="app">
      <div className="card">
        <header className="header">
          <div className="brand">
            <span className="logo">✳</span>
            <h1>TaskFlow</h1>
          </div>
          <p className="subtitle">
            {remaining === 0
              ? "All caught up — nice work!"
              : `${remaining} task${remaining === 1 ? "" : "s"} to go`}
          </p>
        </header>

        <form className="composer" onSubmit={addTask}>
          <input
            className="input"
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New task title"
          />
          <button className="add-btn" type="submit">
            Add
          </button>
        </form>

        <div className="filters">
          {(["all", "active", "completed"] as Filter[]).map((f) => (
            <button
              key={f}
              className={`chip ${filter === f ? "chip--active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="empty">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="empty">Nothing here yet. Add your first task above.</div>
        ) : (
          <ul className="list">
            {visible.map((task) => (
              <li key={task.id} className={`item ${task.completed ? "item--done" : ""}`}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggle(task)}
                  />
                  <span className="checkmark" />
                </label>
                <span className="title">{task.title}</span>
                <button
                  className="delete"
                  onClick={() => remove(task)}
                  aria-label={`Delete ${task.title}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <footer className="foot">Built with React, Vite &amp; Express</footer>
    </div>
  );
}
