import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface Database {
  tasks: Task[];
}

/**
 * A tiny JSON-file backed store. Persistence is intentionally dependency-free
 * so the environment needs no native modules or external database to run.
 */
export class TaskStore {
  private readonly filePath: string;
  private db: Database;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.db = this.load();
  }

  private load(): Database {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, "utf-8");
        const parsed = JSON.parse(raw) as Partial<Database>;
        return { tasks: parsed.tasks ?? [] };
      }
    } catch {
      // Corrupt or unreadable file: start from an empty, valid state.
    }
    return { tasks: [] };
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.db, null, 2), "utf-8");
  }

  list(): Task[] {
    return [...this.db.tasks].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  create(title: string): Task {
    const task: Task = {
      id: randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.db.tasks.push(task);
    this.persist();
    return task;
  }

  update(id: string, patch: Partial<Pick<Task, "title" | "completed">>): Task | null {
    const task = this.db.tasks.find((t) => t.id === id);
    if (!task) return null;
    if (typeof patch.title === "string") task.title = patch.title;
    if (typeof patch.completed === "boolean") task.completed = patch.completed;
    this.persist();
    return task;
  }

  remove(id: string): boolean {
    const before = this.db.tasks.length;
    this.db.tasks = this.db.tasks.filter((t) => t.id !== id);
    const changed = this.db.tasks.length !== before;
    if (changed) this.persist();
    return changed;
  }
}
