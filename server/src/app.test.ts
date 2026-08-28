import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { TaskStore } from "./store.js";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "taskflow-test-"));
  const store = new TaskStore(join(dir, "tasks.json"));
  app = createApp(store);
});

afterEach(() => {
  // Each test gets a fresh temp store, nothing to tear down.
});

describe("TaskFlow API", () => {
  it("reports healthy", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("starts with no tasks", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("creates, updates, and deletes a task end to end", async () => {
    const created = await request(app).post("/api/tasks").send({ title: "Write tests" });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("Write tests");
    expect(created.body.completed).toBe(false);
    const id = created.body.id as string;

    const toggled = await request(app).patch(`/api/tasks/${id}`).send({ completed: true });
    expect(toggled.status).toBe(200);
    expect(toggled.body.completed).toBe(true);

    const listed = await request(app).get("/api/tasks");
    expect(listed.body).toHaveLength(1);

    const removed = await request(app).delete(`/api/tasks/${id}`);
    expect(removed.status).toBe(204);

    const empty = await request(app).get("/api/tasks");
    expect(empty.body).toEqual([]);
  });

  it("rejects a task with no title", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown task", async () => {
    const res = await request(app).patch("/api/tasks/does-not-exist").send({ completed: true });
    expect(res.status).toBe(404);
  });
});
