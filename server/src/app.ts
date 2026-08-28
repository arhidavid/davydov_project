import cors from "cors";
import express, { type Express } from "express";
import { TaskStore } from "./store.js";

export function createApp(store: TaskStore): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/api/tasks", (_req, res) => {
    res.json(store.list());
  });

  app.post("/api/tasks", (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }
    const task = store.create(title);
    res.status(201).json(task);
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { title, completed } = req.body ?? {};
    const patch: { title?: string; completed?: boolean } = {};
    if (typeof title === "string") patch.title = title.trim();
    if (typeof completed === "boolean") patch.completed = completed;
    const task = store.update(req.params.id, patch);
    if (!task) return res.status(404).json({ error: "task not found" });
    res.json(task);
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const removed = store.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: "task not found" });
    res.status(204).end();
  });

  return app;
}
